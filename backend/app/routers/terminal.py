import asyncio
import sys

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["terminal"])


@router.websocket("/api/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()

    cwd = websocket.query_params.get("cwd") or "."
    encoding = "utf-8" if sys.platform != "win32" else "cp866"

    if sys.platform == "win32":
        shell_command = f'powershell.exe -NoLogo -NoExit -Command "Set-Location -LiteralPath \'{cwd.replace(chr(39), "''")}\'"'
    else:
        shell_command = f"bash --login"

    try:
        proc = await asyncio.create_subprocess_shell(
            shell_command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=cwd if sys.platform != "win32" else None,
        )
    except Exception as e:
        await websocket.send_text(f"Failed to start terminal process: {e}\n")
        await websocket.close()
        return

    async def read_output():
        try:
            while proc.returncode is None:
                data = await proc.stdout.read(1024)
                if not data:
                    break
                text = data.decode(encoding, errors="replace")
                await websocket.send_text(text)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            await websocket.send_text(f"\n[Error reading shell output: {e}]\n")

    read_task = asyncio.create_task(read_output())

    try:
        while True:
            command = await websocket.receive_text()
            if not command.endswith("\n"):
                command += "\n"
            proc.stdin.write(command.encode(encoding, errors="replace"))
            await proc.stdin.drain()
    except WebSocketDisconnect:
        pass
    finally:
        read_task.cancel()
        try:
            proc.terminate()
        except ProcessLookupError:
            pass
        await proc.wait()
