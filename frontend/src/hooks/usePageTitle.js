import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const TITLES = {
  '/': 'Чат',
  '/ide/lite': 'IDE Web',
  '/ide': 'Скачать IDE',
  '/pricing': 'Тарифы',
  '/updates': 'Изменения',
  '/spaces': 'Пространства',
  '/artifacts': 'Артефакты',
  '/connectors': 'Коннекторы',
};

export function usePageTitle() {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (TITLES[pathname]) return TITLES[pathname];
    if (pathname.startsWith('/offer') || pathname.startsWith('/privacy')) return 'Документы';
    return 'Nexus';
  }, [pathname]);
}
