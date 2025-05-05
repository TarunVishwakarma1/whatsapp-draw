import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { SocketProvider } from "@/contexts/socket-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DrawChat - WhatsApp Clone with Drawing",
  description: "A WhatsApp clone with collaborative drawing functionality",
    generator: 'v0.dev'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SocketProvider>{children}</SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
