import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import {
  AppleFill,
  WifiOutline,
  SearchOutline,
  ControlOutline,
  LeftOutline,
  RightOutline,
  AppstoreOutline,
  BarsOutline,
  ProjectOutline,
  PlusOutline,
  FolderOutline,
  FileOutline,
  UpOutline,
  DownOutline,
  CloseOutline,
  DesktopOutline,
  FileTextOutline,
  DownloadOutline,
  PictureOutline,
  AudioOutline,
  VideoCameraOutline,
  HddOutline,
  FilePdfOutline,
  FileWordOutline,
  FileExcelOutline,
  FilePptOutline,
  FileZipOutline,
  CodeOutline,
  FolderFill,
  FolderTwoTone,
  FileTwoTone,
  PictureTwoTone,
  VideoCameraTwoTone,
  AudioTwoTone,
  FilePdfTwoTone,
  FileWordTwoTone,
  FileExcelTwoTone,
  FilePptTwoTone,
  FileZipTwoTone,
  FileTextTwoTone,
  AppstoreTwoTone,
  CodeTwoTone,
  HddTwoTone,
  ControlTwoTone,
  ProjectTwoTone
} from '@ant-design/icons-angular/icons';

const icons = [
  AppleFill, WifiOutline, SearchOutline, ControlOutline,
  LeftOutline, RightOutline, AppstoreOutline, BarsOutline,
  ProjectOutline, PlusOutline, FolderOutline, FileOutline,
  UpOutline, DownOutline, CloseOutline, DesktopOutline,
  FileTextOutline, DownloadOutline, PictureOutline, AudioOutline,
  VideoCameraOutline, HddOutline, FilePdfOutline, FileWordOutline,
  FileExcelOutline, FilePptOutline, FileZipOutline, CodeOutline,
  FolderFill, FolderTwoTone, FileTwoTone, PictureTwoTone,
  VideoCameraTwoTone, AudioTwoTone, FilePdfTwoTone, FileWordTwoTone,
  FileExcelTwoTone, FilePptTwoTone, FileZipTwoTone, FileTextTwoTone,
  AppstoreTwoTone, CodeTwoTone, HddTwoTone, ControlTwoTone,
  ProjectTwoTone
];

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideNzIcons(icons)
  ]
};
