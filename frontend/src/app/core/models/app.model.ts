export interface DesktopApp {
  id: string;
  name: string;
  icon: string; // URL or class name for icon
  component?: string; // Reference to the component to render inside WinBox
  isOpen?: boolean;
  isMinimized?: boolean;
  isPinned?: boolean;
}
