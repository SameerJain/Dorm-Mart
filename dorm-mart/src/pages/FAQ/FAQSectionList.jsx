import { FAQItem } from "./FAQItemList";

export default function FAQSectionList({ sections }) {
  return (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
      {sections.map((section) => (
        <section key={section.title} className="space-y-2.5">
          <h2 className="inline-block pl-2 pr-3 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-semibold tracking-wide uppercase text-gray-900 dark:text-gray-100">
            {section.title}
          </h2>
          {section.items.map((item) => (
            <FAQItem
              key={item.question}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
