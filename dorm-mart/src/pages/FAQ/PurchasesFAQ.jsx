import FAQSectionList from "./FAQSectionList";

const PURCHASES_SECTIONS = [
  {
    title: "Purchase History",
    items: [
      {
        question: "Where can I see my past purchases?",
        answer: 'Open the navigation menu and go to "Purchase History."',
      },
      {
        question: "How do I view a receipt?",
        answer: 'Click "See Receipt" on any item in your purchase history.',
      },
    ],
  },
  {
    title: "Ongoing Purchases",
    items: [
      {
        question: "Where are my scheduled purchases?",
        answer:
          "Go to Ongoing Purchases from the navigation menu to see active scheduled purchases.",
      },
      {
        question: "Can I cancel an ongoing purchase?",
        answer:
          "Yes. Open the purchase card and use the cancel option. Please message the other person to let them know.",
      },
    ],
  },
];

function PurchasesFAQ() {
  return <FAQSectionList sections={PURCHASES_SECTIONS} />;
}

export default PurchasesFAQ;
