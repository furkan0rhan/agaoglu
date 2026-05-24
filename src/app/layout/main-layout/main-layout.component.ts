import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SidebarService } from '../sidebar/sidebar.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <!-- Mobil backdrop -->
    @if (isMobile() && sidebarSvc.mobileOpen()) {
      <div
        (click)="sidebarSvc.close()"
        style="position:fixed; inset:0; background:rgba(0,0,0,0.35); z-index:250; backdrop-filter:blur(2px);"
      ></div>
    }

    <app-sidebar></app-sidebar>

    <!-- İçerik alanı -->
    <div class="main-content">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: row; height: 100%; overflow: hidden; }

    .main-content {
      flex: 1;
      min-width: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class MainLayoutComponent {
  readonly sidebarSvc = inject(SidebarService);
  readonly isMobile   = signal(false);

  private touchStartX = 0;
  private touchStartY = 0;
  private mouseStartX = 0;
  private mouseStartY = 0;
  private mouseDragging = false;

  constructor() { this.checkMobile(); }

  @HostListener('window:resize')
  checkMobile(): void {
    this.isMobile.set(window.innerWidth < 1024);
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - this.touchStartY);
    if (dy > 60) return;
    if (dx > 60 && this.touchStartX < 30 && !this.sidebarSvc.mobileOpen()) this.sidebarSvc.open();
    if (dx < -60 && this.sidebarSvc.mobileOpen()) this.sidebarSvc.close();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent): void {
    if (!this.isMobile()) return;
    this.mouseStartX = e.clientX;
    this.mouseStartY = e.clientY;
    this.mouseDragging = true;
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(e: MouseEvent): void {
    if (!this.mouseDragging) return;
    this.mouseDragging = false;
    const dx = e.clientX - this.mouseStartX;
    const dy = Math.abs(e.clientY - this.mouseStartY);
    if (dy > 60) return;
    if (dx > 60 && this.mouseStartX < 30 && !this.sidebarSvc.mobileOpen()) this.sidebarSvc.open();
    if (dx < -60 && this.sidebarSvc.mobileOpen()) this.sidebarSvc.close();
  }
}
