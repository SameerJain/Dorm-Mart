export function FAQItem({ question, answer }) {
  return (
    <div className="pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
        {question}
      </h3>
      <p className="mt-0.5">{answer}</p>
    </div>
  );
}

export default function FAQItemList({ items }) {
  return (
    <div className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
      {items.map((item, index) => (
        <FAQItem
          key={item.question || index}
          question={item.question}
          answer={item.answer}
        />
      ))}
    </div>
  );
}
