import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNzIcons } from 'ng-zorro-antd/icon';

// All icons used across the entire application
import {
  // Brand
  AppleFill,
  // Outline - Navigation
  LeftOutline, RightOutline, UpOutline, DownOutline, ArrowUpOutline,
  // Outline - View modes
  AppstoreOutline, BarsOutline, ProjectOutline, ControlOutline,
  // Outline - Actions
  PlusOutline, CloseOutline, SearchOutline, EditOutline, DeleteOutline,
  CopyOutline, ScissorOutline,
  // Outline - Files & Folders
  FolderOutline, FileOutline, FolderOpenOutline, FileTextOutline,
  DesktopOutline, DownloadOutline, UploadOutline, CloudUploadOutline,
  PictureOutline, AudioOutline, VideoCameraOutline,
  // Outline - File types
  FilePdfOutline, FileWordOutline, FileExcelOutline, FilePptOutline,
  FileZipOutline, CodeOutline, HddOutline,
  // Outline - UI
  StarOutline, InfoCircleOutline, CheckOutline, CheckSquareOutline,
  WarningOutline, WifiOutline, SnippetsOutline, GlobalOutline,
  HomeOutline, SettingOutline, LoadingOutline, CaretUpOutline, CaretDownOutline,
  FolderAddOutline, FileAddOutline,
  // Fill
  FolderFill,
  // TwoTone - Files & Folders
  FolderTwoTone, FileTwoTone, FolderOpenTwoTone, FileTextTwoTone,
  PictureTwoTone, AudioTwoTone, VideoCameraTwoTone,
  // TwoTone - File types
  FilePdfTwoTone, FileWordTwoTone, FileExcelTwoTone, FilePptTwoTone,
  FileZipTwoTone, CodeTwoTone, HddTwoTone, AppstoreTwoTone,
  // TwoTone - UI
  ControlTwoTone, ProjectTwoTone, StarTwoTone, InfoCircleTwoTone,
  EditTwoTone, DeleteTwoTone, CopyTwoTone,
  SnippetsTwoTone, HomeTwoTone, SettingTwoTone,
  WarningTwoTone, CheckSquareTwoTone,
} from '@ant-design/icons-angular/icons';

import { routes } from './app.routes';
import { authInterceptor } from './core/services/auth.interceptor';

const icons = [
  AppleFill,
  LeftOutline, RightOutline, UpOutline, DownOutline, ArrowUpOutline,
  AppstoreOutline, BarsOutline, ProjectOutline, ControlOutline,
  PlusOutline, CloseOutline, SearchOutline, EditOutline, DeleteOutline,
  CopyOutline, ScissorOutline,
  FolderOutline, FileOutline, FolderOpenOutline, FileTextOutline,
  DesktopOutline, DownloadOutline, UploadOutline, CloudUploadOutline,
  PictureOutline, AudioOutline, VideoCameraOutline,
  FilePdfOutline, FileWordOutline, FileExcelOutline, FilePptOutline,
  FileZipOutline, CodeOutline, HddOutline,
  StarOutline, InfoCircleOutline, CheckOutline, CheckSquareOutline,
  WarningOutline, WifiOutline, SnippetsOutline, GlobalOutline,
  HomeOutline, SettingOutline, LoadingOutline, CaretUpOutline, CaretDownOutline,
  FolderAddOutline, FileAddOutline,
  FolderFill,
  FolderTwoTone, FileTwoTone, FolderOpenTwoTone, FileTextTwoTone,
  PictureTwoTone, AudioTwoTone, VideoCameraTwoTone,
  FilePdfTwoTone, FileWordTwoTone, FileExcelTwoTone, FilePptTwoTone,
  FileZipTwoTone, CodeTwoTone, HddTwoTone, AppstoreTwoTone,
  ControlTwoTone, ProjectTwoTone, StarTwoTone, InfoCircleTwoTone,
  EditTwoTone, DeleteTwoTone, CopyTwoTone,
  SnippetsTwoTone, HomeTwoTone, SettingTwoTone,
  WarningTwoTone, CheckSquareTwoTone,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideNzIcons(icons)
  ]
};
