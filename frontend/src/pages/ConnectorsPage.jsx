import SiteNav from '../components/SiteNav';
import LegalFooter from '../components/LegalFooter';
import ConnectorsPageContent from '../features/connectors/ConnectorsPage';

export default function ConnectorsPage() {
  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-200">
      <SiteNav />
      <main className="px-6 py-10">
        <ConnectorsPageContent />
      </main>
      <LegalFooter />
    </div>
  );
}
