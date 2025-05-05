import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-[#128C7E] text-white p-4">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">DrawChat</h1>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 flex flex-col items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <h2 className="text-3xl font-bold">Welcome to DrawChat</h2>
          <p className="text-lg text-gray-600">Chat and draw together in real-time with friends and colleagues.</p>
          <div className="flex flex-col space-y-4">
            <Link href="/login">
              <Button className="w-full bg-[#128C7E] hover:bg-[#0e6b60]">Login</Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="w-full">
                Register
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <footer className="bg-gray-100 p-4 text-center text-gray-600">
        <p>© 2025 DrawChat. All rights reserved.</p>
      </footer>
    </div>
  )
}
