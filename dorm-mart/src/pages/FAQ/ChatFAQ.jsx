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
        question: "Can I send photos or videos in chat?",
        answer:
          "Yes. Use the attachment button next to the message box. Photos can be up to 2 MB and videos up to 25 MB.",
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
          "After the meetup, the seller sends a confirmation request. The buyer accepts after receiving the item and paying or completing the trade. If the buyer doesn't respond within 24 hours, the app accepts the request automatically.",
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
      {
        question: "Can I edit or delete a message?",
        answer:
          "You can edit your last text message and delete your most recent message. Hover over the message, or press and hold it on a phone, to see your options.",
      },
      {
        question: "How do I report a message?",
        answer:
          'Open the message options and choose "Report message". A moderator will review it.',
      },
    ],
  },
];

function ChatFAQ() {
  return <FAQSectionList sections={CHAT_SECTIONS} />;
}

export default ChatFAQ;
