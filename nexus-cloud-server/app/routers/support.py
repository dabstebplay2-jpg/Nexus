"""Пользовательские обращения в поддержку."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import UserDB, get_db
from app.schemas import (
    SupportMessageCreate,
    SupportMessageOut,
    SupportTicketCreate,
    SupportTicketDetail,
    SupportTicketListResponse,
    SupportTicketSummary,
)
from app.security import get_current_user
from app.services.auth_rate_limit import check_rate_limit
from app.services.support_service import (
    add_user_message,
    create_ticket,
    get_user_ticket_detail,
    list_user_tickets,
    notify_admin_new_ticket,
    ticket_detail_payload,
)

router = APIRouter(prefix="/v1/support", tags=["support"])


@router.post("/tickets", response_model=SupportTicketDetail)
async def create_support_ticket(
    payload: SupportTicketCreate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not check_rate_limit(f"support_create:user:{current_user.id}", 5, 3600.0):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много обращений. Попробуйте позже (до 5 в час).",
        )
    ticket = create_ticket(
        db,
        current_user,
        category=payload.category,
        subject=payload.subject,
        body=payload.body,
        attachments=payload.attachments,
    )
    await notify_admin_new_ticket(ticket, current_user, payload.body)
    return ticket_detail_payload(db, ticket)


@router.get("/tickets", response_model=SupportTicketListResponse)
def list_my_tickets(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = list_user_tickets(db, current_user)
    return SupportTicketListResponse(tickets=[SupportTicketSummary(**t) for t in items])


@router.get("/tickets/{ticket_id}", response_model=SupportTicketDetail)
def get_my_ticket(
    ticket_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_user_ticket_detail(db, current_user, ticket_id)
    return SupportTicketDetail(**data)


@router.post("/tickets/{ticket_id}/messages", response_model=SupportMessageOut)
async def post_user_message(
    ticket_id: str,
    payload: SupportMessageCreate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = add_user_message(
        db,
        current_user,
        ticket_id,
        body=payload.body,
        attachments=payload.attachments,
    )
    from app.services.support_service import _message_out as msg_out

    return SupportMessageOut(**msg_out(msg))
