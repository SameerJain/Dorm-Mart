import FAQSectionList from "./FAQSectionList";

const CHAT_SECTIONS = [
  {
    title: "Getting started",
    items: [
      {
        question: "How do I start a conversation?",
        answer:
          'Click "Message Seller" on a listing. Buyers start the conversation, and sellers can reply.',
      },
      {
        question: "Can I send images in chat?",
        answer: "Yes. Use the attachment icon next to the message input.",
      },
    ],
  },
  {
    title: "Scheduling and confirming",
    items: [
      {
        question: 'What does "Schedule Purchase" do?',
        answer:
          "Once you've agreed on a deal in chat, the seller sends a request with the meeting time, location, and agreed price or trade details. The buyer accepts the request to confirm the meetup.",
      },
      {
        question: 'What does "Confirm Purchase" do?',
        answer:
          "After the meetup, the seller sends a confirmation request. The buyer accepts after receiving the item and paying or completing the trade. If the buyer doesn't respond within 24 hours, the app accepts the request automatically. A successful built-in payment completes the purchase without a separate confirmation request.",
      },
      {
        question:
          "What happens when a buyer accepts my scheduled purchase?",
        answer:
          "The buyer agreed to your meetup. Your listing is now Pending, so you can't edit or delete it while the scheduled purchase is active. Use chat to coordinate the meetup, or Ongoing Purchases to cancel.",
      },
    ],
  },
  {
    title: "Managing chats",
    items: [
      {
        question: "What happens if I delete a chat?",
        answer:
          "The chat is hidden from your list. The other person can still see it, and any scheduled purchase stays in place. To cancel a purchase, go to Ongoing Purchases.",
      },
    ],
  },
];

function ChatFAQ() {
  return <FAQSectionList sections={CHAT_SECTIONS} />;
}

export default ChatFAQ;
