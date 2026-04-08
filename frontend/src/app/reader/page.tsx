import { Header } from "./_components/header";
import { Chapters } from "./_components/chapters";
import { Content } from "./_components/content";
import { Highlights } from "./_components/highlights";
import { Footer } from "./_components/footer";

export default function ReaderPage() {
  return (
    <div className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden font-sans">
      <Header />

      {/* 中间主要区域 */}
      <main className="flex flex-1 overflow-hidden">
        <Chapters />

        <Content />

        <Highlights />
      </main>

      <Footer />
    </div>
  );
}
