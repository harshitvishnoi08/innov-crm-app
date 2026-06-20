import { WhatsAppTemplatesOverview } from '@/components/whatsapp-templates/WhatsAppTemplatesOverview';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Message Templates',
  description: 'Manage WhatsApp click-to-chat quick message templates',
};

export default function WhatsAppTemplatesPage() {
  return <WhatsAppTemplatesOverview />;
}
