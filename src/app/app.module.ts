import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';  // Correct StatusBar import
import { SQLiteConnection } from '@capacitor-community/sqlite';  // Correct SQLite import
import { Filesystem } from '@capacitor/filesystem';
import { FilePicker } from 'capacitor-file-picker';  // Corrected FilePicker import
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AudioMetadataDirective } from './directives/audio-metadata.directive';

@NgModule({
  declarations: [
    AppComponent,  // Added AudioMetadataDirective to declarations
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [// Added FilePicker to providers
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
