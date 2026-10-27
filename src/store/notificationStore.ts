import { create } from 'zustand';

interface NotificationState {
  notificationsEnabled: boolean;
  toggleNotifications: () => void;
}

const useNotificationStore = create<NotificationState>((set) => ({
  notificationsEnabled: false,
  toggleNotifications: () =>
    set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
}));

export default useNotificationStore;
