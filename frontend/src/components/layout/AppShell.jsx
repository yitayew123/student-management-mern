		
import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <AppSidebar
        open={sidebarOpen}
        onClose={closeSidebar}
      />

      <div className="app-main">
        <AppHeader
          onMenuClick={() => setSidebarOpen(true)}
          open={sidebarOpen}
        />

        <main
          className="app-content"
          id="main-content"
          tabIndex={-1}
        >
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>Student Management System</span>
          <span>Academic administration workspace</span>
        </footer>
      </div>
    </div>
  );
}
