import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="bms-shell"><aside className="bms-sidebar">
    <a className="bms-brand" href="/dashboard"><span>JR</span><div><strong>JR Concept</strong><small>Business Management</small></div></a>
    <nav>
      <a href="/dashboard">Overview</a>
      <a href="/inventory">Inventory</a>
      <a href="/sales">Sales</a>
      <a href="/expenses">Expenses</a>
      <a href="/customers">Customers</a>
      <a href="/financials">Finances</a>
      <a href="/cash">Cash Journal</a>
      <a href="/reports">Reports</a>
    </nav>
    <form action="/api/auth/logout" method="post"><button type="submit">Sign out</button></form>
  </aside><main className="bms-main">{children}</main></div>;
}
