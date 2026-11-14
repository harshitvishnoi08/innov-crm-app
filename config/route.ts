import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, Settings, UserCheck, Calendar, MessageCircle, MessageSquareText, BarChart3 } from "lucide-react";

export type NavSubItem = {
  title: string;
  href: string;
};

export type NavMainItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: NavSubItem[];
};

export function getCurrentAppConfig(user: unknown) {
  const baseUrl = "/admin";
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === 'ADMIN';

  const navMain: NavMainItem[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Leads",
      url: "/leads",
      icon: UserCheck,
    },
    {
      title: "Meetings",
      url: "/meetings",
      icon: Calendar,
    },
    {
      title: "WhatsApp",
      url: "/whatsapp",
      icon: MessageCircle,
    },
    {
      title: "Message Templates",
      url: "/whatsapp-templates",
      icon: MessageSquareText,
    },
    // Admin-only items (management & marketing). Sales users (role USER) don't see these.
    ...(isAdmin ? [
      {
        title: "Analytics",
        url: "/analytics",
        icon: BarChart3,
      },
      {
        title: "Users",
        url: "/users",
        icon: Users,
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
      },
    ] : []),
  ];

  return {
    baseUrl,
    routes: { navMain },
    user,
  };
}
     
