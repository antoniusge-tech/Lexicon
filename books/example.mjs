/* Sample book — the format the make-book skill writes (one short chapter).
   Try the chapter exercises: npm start, open http://localhost:3000 signed in, then in the console:
     await import('/books/example.mjs')
   Check it without uploading: node scripts/check-book.mjs books/example.mjs */
import { uploadBook } from '../scripts/upload-book.mjs';

export const BOOK = {
  title: 'Sample: The First Interview',
  author: 'Lexicon',
  level: 'B1',
  lang: 'en',
  replace: false,
  targets: ['hire', 'vacancy', 'candidate', 'resume', 'interview', 'salary', 'deadline', 'shortlist', 'skills', 'experience', 'reference', 'job offer'],
  chapters: [
    {
      title: 'Chapter 1. The Vacancy',
      text: `On Monday morning, Maya found a note on her desk: “We need to hire a new developer. Fast.” She had worked in HR for only two weeks, and this was her first real task.

She opened the vacancy on the company website and read it again. The salary was good, but the list of skills was very long. “Nobody has all of this,” she thought, and she cut it in half.

By Wednesday, forty candidates had applied. Maya read every resume with a cup of coffee. Some people had ten years of experience, some had none. One candidate wrote that he was “a ninja of all languages”. She smiled and moved on.

Her manager, Tom, stopped by. “The deadline is Friday,” he said. “Can you shortlist five people by tomorrow?” Maya nodded, although she was not sure.

On Thursday she called the first person for an interview. Her name was Lena, and she answered every question calmly. At the end Maya asked for a reference from her last job. Lena gave her a phone number without a second thought.

On Friday afternoon, Tom read Maya’s notes and said, “Send Lena a job offer.” Maya walked back to her desk with a big smile. Her first hire was almost done.`,
      exercises: {
        questions: [
          { q: 'Why did Maya cut the list of skills in half?', options: ['She thought nobody had all of them.', 'Tom asked her to do it.', 'The website had a word limit.', 'The salary was too low.'], answer: 0, why: '“Nobody has all of this,” she thought.' },
          { q: 'How many candidates applied by Wednesday?', options: ['Forty', 'Five', 'Ten', 'Fourteen'], answer: 0, why: 'By Wednesday, forty candidates had applied.' },
          { q: 'What did Tom want by Thursday?', options: ['A shortlist of five people', 'A new vacancy text', 'A job offer for Lena', 'Ten interviews'], answer: 0, why: 'Can you shortlist five people by tomorrow?' },
          { q: 'What did Maya ask Lena for at the end of the interview?', options: ['A reference from her last job', 'Her resume', 'A higher salary', 'A coding test'], answer: 0, why: 'Maya asked for a reference from her last job.' },
        ],
        fill: [
          { s: 'We need to [[hire]] a new developer.', hint: 'нанимать' },
          { s: 'The [[salary]] was good, but the list of skills was very long.', hint: 'зарплата' },
          { s: 'Maya read every [[resume]] with a cup of coffee.', hint: 'резюме' },
          { s: 'Some people had ten years of [[experience]], some had none.', hint: 'опыт' },
          { s: 'The [[deadline]] is Friday,', hint: 'крайний срок' },
          { s: 'Send Lena a [[job offer]].', hint: 'предложение о работе' },
        ],
        bank: {
          text: 'By Wednesday, forty [[candidates]] had applied. Maya read every [[resume]] with a cup of coffee. Some people had ten years of [[experience]], some had none.',
          extra: ['salaries', 'deadline'],
        },
        dialogue: {
          title: 'Calling Lena',
          you: 'Maya',
          lines: [
            { who: 'Lena', text: 'Hello, this is Lena speaking.', tr: 'Алло, это Лена.' },
            { who: 'Maya', text: 'Hi Lena, I am calling about the [[vacancy]] for a developer.', tr: 'Здравствуйте, Лена, я звоню по поводу вакансии разработчика.' },
            { who: 'Lena', text: 'Oh, great! Did you get my resume?', tr: 'О, отлично! Вы получили моё резюме?' },
            { who: 'Maya', text: 'Yes, and we would like to invite you for an [[interview]].', tr: 'Да, и мы хотели бы пригласить вас на собеседование.' },
            { who: 'Lena', text: 'Of course. When is a good time?', tr: 'Конечно. Когда вам удобно?' },
            { who: 'Maya', text: 'Tomorrow at ten. Please bring a [[reference]] from your last job.', tr: 'Завтра в десять. Пожалуйста, принесите рекомендацию с прошлой работы.' },
            { who: 'Lena', text: 'No problem. See you tomorrow!', tr: 'Без проблем. До завтра!' },
          ],
        },
      },
    },
  ],
};

export default await uploadBook(BOOK);
