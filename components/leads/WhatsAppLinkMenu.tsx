'use client';

import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildWhatsAppFollowUpUrl, buildWhatsAppUrl } from '@/lib/whatsapp-link';
import { cn } from '@/lib/utils';
import { MessageSquare, MessageSquareDashed } from 'lucide-react';

type WhatsAppLinkMenuProps = {
  phone: string;
  customerName?: string | null;
  variant?: 'icon' | 'pill';
  size?: 'sm' | 'md';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
};

export function WhatsAppLinkMenu({
  phone,
  customerName,
  variant = 'icon',
  size = 'md',
  className,
  onClick,
}: WhatsAppLinkMenuProps) {
  const blankUrl = buildWhatsAppUrl(phone);
  const followUpUrl = buildWhatsAppFollowUpUrl(phone, customerName);

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const iconBtnCls =
    size === 'sm'
      ? 'rounded p-1 transition-colors active:scale-90 active:opacity-60'
      : 'rounded-lg p-1.5 transition-colors active:scale-90 active:opacity-60';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'pill' ? (
          <button
            type="button"
            title="WhatsApp"
            onClick={onClick}
            className={cn(
              'flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500 transition-colors active:opacity-60 hover:bg-green-500/20',
              className,
            )}
          >
            <WhatsAppIcon className="h-3 w-3" />
            WhatsApp
          </button>
        ) : (
          <button
            type="button"
            title="WhatsApp"
            onClick={onClick}
            className={cn(
              iconBtnCls,
              'text-muted-foreground hover:bg-green-500/10 hover:text-green-500',
              className,
            )}
          >
            <WhatsAppIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuItem
          onClick={e => {
            e.stopPropagation();
            openLink(followUpUrl);
          }}
        >
          <MessageSquare className="h-4 w-4" />
          Follow-up template
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={e => {
            e.stopPropagation();
            openLink(blankUrl);
          }}
        >
          <MessageSquareDashed className="h-4 w-4" />
          Blank message
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
