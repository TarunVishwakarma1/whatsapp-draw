import { Suspense } from "react"
import ChatPage from "./chatpage" // adjust path as necessary

export default function ChatPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPage />
    </Suspense>
  )
}