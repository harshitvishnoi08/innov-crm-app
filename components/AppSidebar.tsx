'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from './ui/sidebar';
import { getCurrentAppConfig } from '@/config/route';
import { usePathname } from 'next/navigation';
import { BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb';
import { NavUser } from './NavUser';
import { Button } from './ui/button';
import { Breadcrumb, BreadcrumbItem } from './ui/breadcrumb';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { useRef, useState, useSyncExternalStore } from 'react';
import NavFooter from '@/components/NavFooter';
import { useAuth } from '@/contexts/AuthContext';
import { InnovAiPanel } from '@/components/ai/InnovAiPanel';

function MobileSidebarCloser() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);
  return null;
}

export function AppSidebar({ children, ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const user = useAuth();
  const navigationConfig = getCurrentAppConfig(user);
  const baseUrl = navigationConfig?.baseUrl;
  const routes = navigationConfig?.routes;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const contentRef = useRef(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!navigationConfig || !routes || !baseUrl) {
    return null;
  }

  const generateBreadcrumbs = (pathname: string) => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [];
    let currentPath = '';

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      currentPath += `/${segment}`;

      // First try to find as a main navigation item
      const navItem = routes.navMain.find((item) => {
        const itemPath = item.url.split('/').filter(Boolean)[0];
        return itemPath === segment;
      });

      if (navItem) {
        breadcrumbs.push({
          href: `${baseUrl}${navItem.url}`,
          name: navItem.title,
          isLast: i === pathSegments.length - 1,
        });
      } else {
        // If not found as main nav item, try to find as sub-item
        let foundSubItem = false;

        for (const mainItem of routes.navMain) {
          if (mainItem.items) {
            const subItem = mainItem.items.find((sub) => {
              const subPath = sub.href.split('/').filter(Boolean).pop();
              return subPath === segment;
            });

            if (subItem) {
              breadcrumbs.push({
                href: `${baseUrl}${subItem.href}`,
                name: subItem.title,
                isLast: i === pathSegments.length - 1,
              });
              foundSubItem = true;
              break;
            }
          }
        }

        // If not found as sub-item either, treat as regular segment
        if (!foundSubItem) {
          const parts = segment.split('-');
          const name = (parts.length > 1 ? parts.slice(0, -1) : parts)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          if (baseUrl.split('/').slice(-1)[0] === currentPath.split('/').slice(-1)[0]) {
            breadcrumbs.push({
              href: baseUrl,
              name,
              isLast: pathSegments.length === 0,
            });
          } else {
            breadcrumbs.push({
              href: `${baseUrl}${currentPath}`,
              name,
              isLast: i === pathSegments.length - 1,
            });
          }
        }
      }
    }

    return breadcrumbs;
  };
  const breadcrumbs = generateBreadcrumbs(pathname);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }

    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  return (
    <SidebarProvider>
      <MobileSidebarCloser />
      <Sidebar collapsible='icon' {...props}>
        <SidebarHeader>
          <NavUser />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {routes.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {mounted && item.items ? (
                      <Collapsible
                        defaultOpen={pathname.startsWith(`${baseUrl}${item.url}`)}
                        className='group/collapsible'
                      >
                        <CollapsibleTrigger asChild className='w-full'>
                          <SidebarMenuButton
                            tooltip={item.title}
                            asChild={!!item.url}
                            isActive={
                              pathname === `${baseUrl}${item.url}` ||
                              (pathname.startsWith(`${baseUrl}${item.url}`) && item.url !== '/')
                            }
                          >
                            {item.url ? (
                              <Link href={`${baseUrl}${item.url}`}>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                                <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                              </Link>
                            ) : (
                              <>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                                <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items?.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild isActive={pathname === `${baseUrl}${subItem.href}`}>
                                  <Link href={`${baseUrl}${subItem.href}`}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <>
                        <SidebarMenuButton tooltip={item.title} isActive={pathname === `${baseUrl}${item.url}`} asChild>
                          <Link href={`${baseUrl}${item.url}`}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.items && (
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild isActive={pathname === `${baseUrl}${subItem.href}`}>
                                  <Link href={`${baseUrl}${subItem.href}`}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        )}
                      </>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <NavFooter />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className='flex h-dvh flex-col overflow-hidden'>
        <header className='flex h-16 shrink-0 items-center gap-2 border-b px-4'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mr-2 h-4' />
          <Breadcrumb className='min-w-0 flex-1 overflow-hidden'>
            <BreadcrumbList className='flex-nowrap'>
              {breadcrumbs.map((crumb) => (
                <React.Fragment key={crumb.href}>
                  <BreadcrumbItem className='min-w-0'>
                    {crumb.isLast ? (
                      <BreadcrumbPage className='block max-w-[140px] truncate sm:max-w-xs'>{crumb.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href} className='block max-w-[100px] truncate sm:max-w-[160px]'>{crumb.name}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!crumb.isLast && <BreadcrumbSeparator />}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <div className='ml-auto flex shrink-0 items-center space-x-2'>
            <InnovAiPanel />
            <Button variant='outline' size='sm' onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              <span className='hidden sm:inline'>Refresh</span>
            </Button>
          </div>
        </header>
        <div className='min-h-0 flex-1 overflow-auto' ref={contentRef}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
