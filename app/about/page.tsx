import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-[#128C7E] text-white p-4">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">DrawChat</h1>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 py-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">About DrawChat</h2>

          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-semibold mb-2">What is DrawChat?</h3>
              <p className="text-gray-700">
                DrawChat is a messaging platform that combines the familiar chat experience with collaborative drawing
                capabilities. It allows you to communicate through text messages while also sharing a canvas where you
                can draw and sketch together in real-time.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2">Features</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Real-time messaging with friends and groups</li>
                <li>Collaborative drawing canvas</li>
                <li>Share drawings directly in your chats</li>
                <li>Multiple drawing tools and colors</li>
                <li>Works on both mobile and desktop devices</li>
                <li>Download and save your collaborative artwork</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2">How It Works</h3>
              <p className="text-gray-700">
                DrawChat uses advanced real-time technology to ensure that your messages and drawing strokes are
                instantly visible to everyone in the conversation. Simply select a chat, switch to the drawing tab, and
                start creating together!
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2">Get Started</h3>
              <p className="text-gray-700 mb-4">
                Ready to try DrawChat? Click the button below to start chatting and drawing with your friends and
                colleagues.
              </p>
              <Link href="/chat">
                <Button className="bg-[#128C7E] hover:bg-[#0e6b60]">Start Using DrawChat</Button>
              </Link>
            </section>
          </div>
        </div>
      </main>
      <footer className="bg-gray-100 p-4 text-center text-gray-600">
        <p>© 2025 DrawChat. All rights reserved.</p>
      </footer>
    </div>
  )
}
