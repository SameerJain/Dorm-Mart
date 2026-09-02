import FAQSectionList from "./FAQSectionList";

const CHAT_SECTIONS = [
  {
    title: "Getting Started",
    items: [
      {
        question: "How do I start a conversation?",
        answer:
          'Click "Message Seller" on any item\'s detail page. Only buyers can initiate conversations.',
      },
      {
        question: "Can I send images in chat?",
        answer: "Yes. Use the attachment icon next to the message input.",
      },
    ],
  },
  {
    title: "Scheduling & Confirming",
    items: [
      {
        question: "What is Schedule Purchase?",
        answer:
          "After agreeing on a deal, the seller sends a request with the meeting time, location, and final price. The buyer accepts to lock it in.",
      },
      {
        question: "What is Confirm Purchase?",
        answer:
          "After meeting in person, the seller sends a confirmation request. The buyer accepts after receiving the item and paying. Auto-confirms after 24 hours if ignored.",
      },
      {
        question:
          "I'm a seller: what does it mean when a buyer accepted a scheduled purchase?",
        answer:
          "Your proposed meetup was accepted. The sale is in progress—you can't edit or delete that listing until it completes or is cancelled. Use Ongoing Purchases and chat to coordinate or cancel.",
      },
    ],
  },
  {
    title: "Managing Chats",
    items: [
      {
        question: "What happens if I delete a chat?",
        answer:
          "It's removed on your side only. If there's an active scheduled purchase for that item, it gets automatically cancelled.",
      },
    ],
  },
];

function ChatFAQ() {
  return <FAQSectionList sections={CHAT_SECTIONS} />;
}

export default ChatFAQ;
