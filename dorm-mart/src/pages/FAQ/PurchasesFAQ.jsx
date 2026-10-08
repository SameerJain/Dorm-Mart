import FAQSectionList from "./FAQSectionList";

const PURCHASES_SECTIONS = [
  {
    title: "Purchase history",
    items: [
      {
        question: "Where can I see my past purchases?",
        answer: "Open the navigation menu and choose Purchase History.",
      },
      {
        question: "How do I view a receipt?",
        answer: 'Find the item in Purchase History and click "See Receipt".',
      },
    ],
  },
  {
    title: "Ongoing purchases",
    items: [
      {
        question: "Where are my scheduled purchases?",
        answer:
          "Open the navigation menu and choose Ongoing Purchases to see your scheduled purchases.",
      },
      {
        question: "Can I cancel an ongoing purchase?",
        answer:
          "Yes, while the Cancel button is available on the purchase card in Ongoing Purchases. Click it and confirm the cancellation. Send the other person a message to let them know.",
      },
    ],
  },
];

function PurchasesFAQ() {
  return <FAQSectionList sections={PURCHASES_SECTIONS} />;
}

export default PurchasesFAQ;
