// Interface language: English (default) or Vietnamese. The English text is the key, so a missing entry simply shows English.
// Rule for every Vietnamese string: metric names, SQL keywords, table and column names and the usual analytics terms
// (so-what, insights, grain, JOIN, hint) stay in English. Case-study prose lives in data/cases.vi.json, not here.
const KEY = "lab:lang";
let lang = "en";
try { lang = localStorage.getItem(KEY) === "vi" ? "vi" : "en"; } catch (e) { }
const subs = [];

export const getLang = () => lang;
export const onLang = f => subs.push(f);
export function setLang(l) {
  l = l === "vi" ? "vi" : "en"; if (l === lang) return;
  lang = l; try { localStorage.setItem(KEY, l); } catch (e) { }
  document.documentElement.lang = l; applyStatic(); subs.forEach(f => f(l));
}
export const t = (s, v) => {
  let o = (lang === "vi" && VI[s]) || s;
  if (v) o = o.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  return o;
};

// Elements marked data-i18n in index.src.html keep their English text in data-en and are re-labelled on every switch.
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.dataset.en ??= el.textContent.trim(); el.textContent = t(el.dataset.en); });
  root.querySelectorAll("[data-i18n-attr]").forEach(el => { const [a, en] = el.dataset.i18nAttr.split("|"); el.setAttribute(a, t(en)); });
  document.querySelectorAll("#langsw [data-l]").forEach(b => b.setAttribute("aria-pressed", b.dataset.l === lang));
}
document.documentElement.lang = lang;

const VI = {
  "Metric": "Metric", "Definition": "Định nghĩa", "From:": "Từ:", "To:": "Đến:", "Subject:": "Tiêu đề:", "You, Data Analyst": "Bạn, Data Analyst",
  "The business.": "Doanh nghiệp.", "What is going on.": "Chuyện gì đang xảy ra.", "The decision at stake.": "Quyết định cần đưa ra.",
  "Table names match the class SQL Server database (<code>ADW_</code>, <code>CRM_</code>, <code>GBE_</code>), so a query written here pastes into SQL Server unchanged.": "Tên bảng khớp với database SQL Server của lớp (<code>ADW_</code>, <code>CRM_</code>, <code>GBE_</code>), nên query viết ở đây dán vào SQL Server là chạy.",
  "{label} (locked: {n}/{m} tries)": "{label} (đang khoá: {n}/{m} lần thử)", "{label} (locked: {n}/{m} characters)": "{label} (đang khoá: {n}/{m} ký tự)",
  "Compare your structure and your reasoning with the outline, not only the conclusion.": "Hãy so cấu trúc và cách lập luận của bạn với outline, không chỉ so kết luận.",
  "Rules for the hint and the model outline": "Quy tắc mở hint và model outline",
  "Write your own first draft in the box above, at least {n} characters (a few lines). It can be rough.": "Viết bản nháp đầu của riêng bạn vào ô phía trên, ít nhất {n} ký tự (vài dòng). Nháp thô cũng được.",
  "Then open the hint when you are stuck, and the model outline to compare with your draft.": "Sau đó mở hint khi bị kẹt, và mở model outline để so với bản nháp của bạn.",
  "Your draft: {x} of {n} characters. Stuck? Send your mentors what you have written and where you got stuck.": "Bản nháp của bạn: {x}/{n} ký tự. Kẹt rồi? Gửi mentor những gì bạn đã viết và chỗ bạn bị kẹt.",
  "Make at least {n} different tries. A try is a Run or a Check with a changed query. Running the same query again does not count.": "Thử ít nhất {n} lần khác nhau. Một lần thử là một lần Run hoặc Check với query đã sửa. Chạy lại đúng query cũ không được tính.",
  "Rough tries are fine, and a query that errors still counts.": "Lần thử còn thô cũng được, và query bị lỗi vẫn được tính.",
  "Then open the hint when you are stuck, and the model answer to compare with your own result.": "Sau đó mở hint khi bị kẹt, và mở model answer để so với kết quả của chính bạn.",
  "Your tries: {x} of {n}. Still stuck after {n}? Send your mentors your query and the point where you got stuck.": "Số lần thử: {x}/{n}. Vẫn kẹt sau {n} lần? Gửi mentor query của bạn và chỗ bạn bị kẹt.",
  // nav and footer
  "Home": "Trang chủ", "Study Guides": "Study Guides", "Homework": "Bài tập", "Interview Prep": "Interview Prep",
  "Case Studies": "Case Studies", "Data Dictionary": "Data Dictionary", "Playground": "Playground",
  "Installation For mentee": "Hướng dẫn cài đặt cho mentee", "Log out": "Đăng xuất",
  "Next step": "Bước tiếp theo",
  "Want to learn the full data-analytics workflow?": "Muốn học trọn quy trình data analytics?",
  "This Lab is one part of the TheHauData course: real-life case studies, a data-driven mindset, and the right tech stack (SQL, Power BI, Python, statistics), with a mentor beside you.": "Lab này là một phần của khoá học TheHauData: case study thực tế, tư duy data-driven và bộ công cụ phù hợp (SQL, Power BI, Python, statistics), có mentor đi cùng.",
  "See the upcoming course ↗": "Xem khoá học sắp tới ↗", "Ask the mentor on Zalo": "Hỏi mentor qua Zalo",
  "Real-life case studies and a data-driven mindset, with SQL practice built in. Built for the mentees of the TheHauData Mentoring Program by Quoc-Hau Le.": "Case study thực tế và tư duy data-driven, có sẵn phần luyện SQL. Làm cho mentee của TheHauData Mentoring Program, bởi Lê Quốc Hậu.",
  "Practice": "Luyện tập", "Homework by topic": "Bài tập theo chủ đề", "Courses and mentoring": "Khoá học và mentoring", "About the mentor": "Về mentor",
  "© 2026 TheHauData Academy · Quoc-Hau Le · All rights reserved": "© 2026 TheHauData Academy · Lê Quốc Hậu · Bảo lưu mọi quyền",
  // engine pill and SQL panel
  "SQL loads on first Run": "SQL sẽ tải khi bấm Run lần đầu", "SQL ready": "SQL sẵn sàng", "SQL engine error": "Lỗi SQL engine",
  "Loading the SQL engine… {n}%": "Đang tải SQL engine… {n}%",
  "The SQL engine (about 40 MB) loads the first time you press Run.": "SQL engine (khoảng 40 MB) sẽ tải ở lần Run đầu tiên.",
  "Loading the SQL engine… {n}%. About 10 seconds the first time.": "Đang tải SQL engine… {n}%. Lần đầu mất khoảng 10 giây.",
  "Tables you can use": "Các bảng có thể dùng", "Loading…": "Đang tải…", "Run": "Run", "Check my answer": "Kiểm tra đáp án", "Reset to blank": "Xoá về trống",
  "Ctrl+Enter runs the query. Tab indents; press Esc, then Tab, to move on to the next control.": "Ctrl+Enter để chạy query. Tab để thụt dòng; bấm Esc rồi Tab để chuyển sang nút kế tiếp.",
  " Your draft is saved in this browser.": " Bản nháp được lưu ngay trong trình duyệt này.",
  "See it translated to DuckDB": "Xem bản dịch sang DuckDB", "Run a query to see the translation.": "Chạy một query để xem bản dịch.",
  "SQL editor": "SQL editor", "Question, hint and answer": "Đề bài, hint và đáp án", "Context, plan and hints": "Context, plan và hints",
  "{n} rows · {ms} ms": "{n} dòng · {ms} ms", " · showing the first 200": " · hiển thị 200 dòng đầu",
  // domains and data used
  "Data used": "Data sử dụng",
  // playground
  "Free practice": "Luyện tập tự do",
  "An open editor on the class tables, with no exercise attached. Pick a dataset to see its tables.": "Editor trống trên các bảng của lớp, không gắn với bài tập nào. Chọn dataset để xem các bảng.",
  // home
  "TheHauData Mentoring Program": "TheHauData Mentoring Program",
  "Think like an analyst.": "Tư duy như một analyst.", "Solve real business cases": "Giải case kinh doanh thực tế",
  " with a data-driven mindset and the right tech stack.": " với tư duy data-driven và bộ công cụ phù hợp.",
  "Every exercise starts from a question a business would really ask. You decide what to measure and why, choose the right tool for the job (SQL, Power BI, Python, statistics), and finish with a conclusion you can defend. This Lab is where you practise the SQL part on the class tables.": "Mỗi bài tập bắt đầu từ một câu hỏi mà doanh nghiệp thật sự sẽ hỏi. Bạn tự quyết định đo cái gì và vì sao, chọn công cụ phù hợp (SQL, Power BI, Python, statistics) và kết thúc bằng một kết luận có thể bảo vệ được. Lab này là nơi bạn luyện phần SQL trên các bảng của lớp.",
  "Real-life case studies": "Case study thực tế", "Requests that come from real companies, solved from brief to recommendation.": "Những request đến từ công ty thật, giải từ brief đến recommendation.",
  "Analytical mindset": "Tư duy phân tích", "Plan the approach and the metrics first. Syntax comes second.": "Lên approach và metrics trước. Syntax tính sau.",
  "Practical, hands-on": "Thực hành, làm thật", "Run T-SQL in the browser on the same tables used in class.": "Chạy T-SQL ngay trên trình duyệt, trên chính các bảng dùng trong lớp.",
  "Try first, then compare": "Thử trước, so sánh sau", "Hints along the way. Hints and model answers open after 5 different tries.": "Có hint dọc đường. Hint và model answer mở sau 5 lần thử khác nhau.",
  "What's new": "Có gì mới", "Latest from the course": "Mới nhất từ khoá học", "Open": "Mở",
  "SQL, BI and analytics": "SQL, BI và analytics", "A one-page recap of each lesson, then the classwork and homework solved step by step, with small labs to try.": "Tóm tắt mỗi bài học trong một trang, rồi classwork và homework được giải từng bước, kèm các lab nhỏ để thử.",
  "{n} guides": "{n} guides", "SQL topics": "Chủ đề SQL",
  "{n} business questions from the SQL lessons, with hints, an answer check and the model answer.": "{n} câu hỏi business từ các bài SQL, có hint, kiểm tra đáp án và model answer.",
  "{n} with auto-check": "{n} câu có auto-check", "{n}/{m} done": "{n}/{m} đã xong",
  "3 rounds + Big Tech SQL": "3 vòng + Big Tech SQL",
  "{n} questions in the style of real analyst tests: a SQL screen, a metrics and ops round, a take-home case and 13 big-tech SQL questions, each with a target time.": "{n} câu hỏi theo phong cách bài test analyst thật: vòng SQL, vòng metrics và ops, take-home case và 13 câu SQL của các công ty big tech, mỗi câu có thời gian mục tiêu.",
  "About 4 hours in total": "Tổng cộng khoảng 4 giờ", "3 steps each": "Mỗi case 3 bước",
  "{n} cases: read the request, plan your approach, then solve, chart and conclude.": "{n} case: đọc request, lên approach, rồi giải, vẽ chart và kết luận.",
  "{n} run live on the real tables": "{n} case chạy trực tiếp trên bảng thật", "Reference": "Tham khảo",
  "Every class table: columns, types, keys, missing values and how the tables join, on a relationship map you can search.": "Mọi bảng của lớp: cột, kiểu dữ liệu, key, giá trị thiếu và cách các bảng join, trên một relationship map có thể tìm kiếm.",
  "ADW, CRM, GBE and more": "ADW, CRM, GBE và các bảng khác", "An open editor on the AdventureWorks, CRM and Global Electronics tables.": "Editor trống trên các bảng AdventureWorks, CRM và Global Electronics.",
  "No exercise attached": "Không gắn bài tập",
  "Learning guidelines": "Hướng dẫn học", "How to learn with the Lab": "Cách học với Lab",
  "The Lab lets you open hints and model answers while you practise. These guidelines show how to use them so the practice builds your own skill.": "Lab cho phép bạn mở hint và model answer khi luyện tập. Các hướng dẫn dưới đây giúp bạn dùng chúng sao cho việc luyện tập thật sự xây được kỹ năng của chính bạn.",
  "1. How to practise a question": "1. Cách luyện một câu hỏi",
  "Read the question and write your approach first, on paper or as a comment in the editor: which tables, what one row means (the grain), which metric. Two or three minutes is enough.": "Đọc đề và viết approach trước, ra giấy hoặc làm comment trong editor: dùng bảng nào, một dòng nghĩa là gì (grain), metric nào. Hai ba phút là đủ.",
  "Write your query and run it. A rough first version is fine.": "Viết query và chạy. Bản đầu còn thô cũng không sao.",
  "Look at your result before you read any feedback. Check the row count, the columns and a few numbers against what the question asks. If something looks off, try to find out why before you open anything.": "Nhìn kết quả của mình trước khi đọc bất kỳ feedback nào. Kiểm tra số dòng, các cột và vài con số xem có khớp với đề không. Nếu thấy lệch, cố tìm lý do trước khi mở gì ra.",
  "Press Check my answer (or compare with the expected output on open questions). Keep trying and changing your query: the hint and the model answer open after 5 different tries.": "Bấm Kiểm tra đáp án (hoặc so với expected output ở câu mở). Cứ thử và sửa query: hint và model answer sẽ mở sau 5 lần thử khác nhau.",
  "2. When to open hints and model answers": "2. Khi nào nên mở hint và model answer",
  "<b>Hints:</b> open one when you have been stuck on the same problem for a while. Go back to your query after each hint and open the next one only if you are still stuck. In the Case Studies, hints come in order: a nudge first, then how to break the problem down, then what usually goes wrong.": "<b>Hint:</b> mở một hint khi bạn đã kẹt ở cùng một vấn đề khá lâu. Sau mỗi hint, quay lại query của mình và chỉ mở hint tiếp theo nếu vẫn còn kẹt. Trong Case Studies, hint đi theo thứ tự: gợi ý nhẹ trước, rồi cách chia nhỏ vấn đề, rồi những lỗi hay gặp.",
  "<b>Model answers:</b> open them after you have a result of your own, correct or not. For case studies and written tasks, write your own conclusion first, then compare.": "<b>Model answer:</b> chỉ mở sau khi bạn đã có kết quả của riêng mình, đúng hay sai đều được. Với case study và bài viết, hãy viết kết luận của bạn trước rồi mới so sánh.",
  "<b>The 5-try rule:</b> on homework, the hint and the model answer open after 5 different tries (a Run or a Check with a changed query). A query that errors still counts. On written tasks, write a first draft of about 80 characters first.": "<b>Quy tắc 5 lần thử:</b> ở bài tập, hint và model answer mở sau 5 lần thử khác nhau (một lần Run hoặc Check với query đã sửa). Query bị lỗi vẫn được tính. Với bài viết, hãy viết bản nháp đầu khoảng 80 ký tự trước.",
  "<b>Still stuck after that?</b> Send your mentors your query and the point where you got stuck. That message teaches you more than the answer alone.": "<b>Vẫn kẹt sau đó?</b> Gửi mentor query của bạn và chỗ bạn bị kẹt. Tin nhắn đó dạy bạn nhiều hơn là chỉ đọc đáp án.",
  "3. How to use a model answer": "3. Cách dùng một model answer",
  "Compare the logic before the syntax: the grain, the joins, the filters and how the metric is defined.": "So sánh logic trước syntax: grain, các JOIN, filter và cách metric được định nghĩa.",
  "If your result matched but your SQL looks different, ask which version a colleague would find easier to read, and which one still works with ten times the data.": "Nếu kết quả khớp nhưng SQL của bạn khác, hãy hỏi: bản nào đồng nghiệp đọc dễ hơn, và bản nào vẫn chạy ổn khi data nhiều gấp mười lần.",
  "If your result did not match, find the first line where your logic and the model answer split. Fix your own query from that line and run it again.": "Nếu kết quả không khớp, tìm dòng đầu tiên mà logic của bạn và model answer rẽ khác nhau. Sửa query của bạn từ dòng đó rồi chạy lại.",
  "The next day, close the answer and rewrite the query from memory. Write one line on what you would do differently next time.": "Hôm sau, đóng đáp án lại và viết lại query từ trí nhớ. Ghi một dòng về điều bạn sẽ làm khác đi lần sau.",
  "Good to know": "Cần biết", "Queries run in your browser. Nothing you type is sent anywhere.": "Query chạy ngay trong trình duyệt. Không có gì bạn gõ bị gửi đi đâu cả.",
  "The first load downloads the SQL engine, about 40 MB. After that it opens from the cache.": "Lần đầu sẽ tải SQL engine, khoảng 40 MB. Sau đó mở từ cache.",
  "Loading": "Đang tải", "Something went wrong": "Có lỗi xảy ra",
  // homework
  "Homework, by topic": "Bài tập theo chủ đề",
  "The business questions from the course, on the same tables as the class database. Write T-SQL, run it, and check your answer. Some topics also have written analytics tasks: no SQL, you write the answer, then compare it with a model outline. Hints and model answers stay closed until you open them.": "Các câu hỏi business trong khoá học, trên chính các bảng của class database. Viết T-SQL, chạy và kiểm tra đáp án. Một số chủ đề còn có bài analytics dạng viết: không cần SQL, bạn viết câu trả lời rồi so với model outline. Hint và model answer luôn đóng cho đến khi bạn mở.",
  "Your progress": "Tiến độ của bạn", "Pick a topic": "Chọn chủ đề", "Pick a round": "Chọn vòng",
  "Each question names the tables it needs. Table names match SQL Server, so queries paste in unchanged.": "Mỗi câu hỏi nêu tên các bảng cần dùng. Tên bảng khớp với SQL Server nên query dán qua là chạy.",
  "Export my work": "Xuất bài làm", "Your name": "Tên của bạn", "Summary to send to your mentor": "Bản tóm tắt gửi cho mentor",
  "Copy to clipboard": "Copy", "Download .txt": "Tải .txt", "Copied.": "Đã copy.", "Downloaded.": "Đã tải.",
  "How answers are checked": "Cách đáp án được kiểm tra",
  "<b>Auto-check:</b> the page compares the rows you return with the model output. Column order, column names and extra columns do not matter.": "<b>Auto-check:</b> trang so các dòng bạn trả về với model output. Thứ tự cột, tên cột và cột thừa đều không quan trọng.",
  "<b>Compare:</b> when the answer depends on how you define a metric, open the model answer and compare your logic and numbers.": "<b>Compare:</b> khi đáp án phụ thuộc vào cách bạn định nghĩa metric, hãy mở model answer và so sánh logic lẫn con số.",
  "<b>Write-up:</b> a written task with guidelines. Write your answer first. The approach hint (with the SQL questions and cases to practise on) and the model outline open after a first draft.": "<b>Write-up:</b> bài viết có guideline. Viết câu trả lời trước. Approach hint (kèm các câu SQL và case để luyện) và model outline mở sau khi bạn có bản nháp đầu.",
  "← All topics": "← Tất cả chủ đề", "← All rounds": "← Tất cả các vòng", "← All challenges": "← Tất cả các case",
  "All": "Tất cả", "Easy": "Dễ", "Medium": "Trung bình", "Hard": "Khó", "No questions at this level.": "Chưa có câu hỏi ở mức này.",
  "Auto-check": "Auto-check", "Write-up": "Write-up", "Compare": "Compare", "✓ Done": "✓ Xong",
  "Hint": "Hint", "Approach hint": "Approach hint", "Model outline": "Model outline", "Approach and model answer": "Approach và model answer",
  "Write your query on the right, then press <b>Check my answer</b>": "Viết query ở bên phải, rồi bấm <b>Kiểm tra đáp án</b>",
  "Write your query on the right, then press Run and compare with the model answer": "Viết query ở bên phải, rồi bấm Run và so với model answer",
  "Your conclusion": "Kết luận của bạn", "Your answer": "Câu trả lời của bạn", "Guidelines": "Guidelines",
  "What would you tell the business, based on your numbers? One or two sentences.": "Bạn sẽ nói gì với business, dựa trên con số của mình? Một hai câu thôi.",
  "Write your answer here. It is saved in this browser only.": "Viết câu trả lời ở đây. Chỉ lưu trong trình duyệt này.",
  "Rules for the hint and the model answer": "Quy tắc mở hint và model answer",
  "Hint and model answer are open.": "Hint và model answer đã mở.", "Hint and model outline are open.": "Hint và model outline đã mở.",
  "Compare your logic first (grain, joins, filters, metric), then the syntax.": "So sánh logic trước (grain, JOIN, filter, metric), rồi mới đến syntax.",
  "Correct. Your result matches the model answer.": "Đúng. Kết quả của bạn khớp với model answer.",
  "Copy into the editor": "Copy vào editor", "Run the model query": "Chạy model query", "Model query": "Model query", "Step {n}": "Bước {n}",
  "Loading the model answer…": "Đang tải model answer…", "Loading the model outline…": "Đang tải model outline…",
  "Continue: {a}, {b}": "Tiếp tục: {a}, {b}",
  "{n} of {m} questions done ({p}%). Progress is saved in this browser only.": "{n}/{m} câu đã xong ({p}%). Tiến độ chỉ lưu trong trình duyệt này.",
  "{n} questions": "{n} câu hỏi",
  // cases
  "Case Study Practice Zone": "Case Study Practice Zone",
  "Case studies on the class databases, from junior to senior level. Each takes 15 to 30 minutes and has three steps: read the business context, plan your approach, then solve, chart and conclude. Hints, expected SQL and model answers stay closed until you open them. Step 3 has an editor that runs your T-SQL on the real tables.": "Case study trên các database của lớp, từ junior đến senior. Mỗi case mất 15 đến 30 phút, gồm ba bước: đọc business context, lên approach, rồi giải, vẽ chart và kết luận. Hint, SQL mẫu và model answer luôn đóng cho đến khi bạn mở. Bước 3 có editor chạy T-SQL trên bảng thật.",
  "What this zone trains: analytical thinking.": "Khu này rèn: tư duy phân tích.",
  " Every case asks you to name the decision, the metric and the trap before you write any SQL, then compares your thinking with ours. SQL is the tool, the judgment is the skill.": " Mỗi case yêu cầu bạn gọi tên decision, metric và cái bẫy trước khi viết bất kỳ dòng SQL nào, rồi so cách nghĩ của bạn với cách nghĩ của chúng tôi. SQL là công cụ, judgment mới là kỹ năng.",
  "Rank = difficulty:": "Rank = độ khó:", "C · Junior": "C · Junior", "B · Analyst": "B · Analyst", "A · Senior": "A · Senior",
  " one or two tables, one clear metric ": " một hai bảng, một metric rõ ràng ", " a few tables, a judgment call ": " vài bảng, cần judgment ", " a trap in the obvious comparison": " có bẫy trong phép so sánh hiển nhiên",
  "More databases:": "Thêm database:", " web analytics and loyalty data, too large to load here. Run the SQL in SQL Server; the expected output is shown.": " web analytics và loyalty data, quá lớn để tải ở đây. Chạy SQL trong SQL Server; expected output có sẵn để đối chiếu.",
  "⏱ {n} min": "⏱ {n} phút", "Context": "Context", "Approach": "Approach", "Solve & conclude": "Solve & conclude", "~3 min": "~3 phút", "~4 min": "~4 phút", "~10 min": "~10 phút",
  "Business context": "Business context", "Read this before the request": "Đọc phần này trước khi đọc request",
  "Incoming request": "Request đến", "Key questions": "Key questions", "What you need to answer": "Những gì bạn cần trả lời", "Suggested metrics (define your own first)": "Metrics gợi ý (tự định nghĩa trước đã)",
  "Do not touch the data yet. <b>Think first:</b> write your plan below, then open the hints one at a time.": "Chưa đụng vào data vội. <b>Nghĩ trước:</b> viết plan của bạn ở dưới, rồi mở từng hint một.",
  "Your turn": "Đến lượt bạn", "Sketch your approach": "Phác thảo approach của bạn",
  "Which decision sits behind this? Which metrics would you compute? Which tables? What could mislead you?": "Decision nào nằm sau yêu cầu này? Bạn sẽ tính metrics nào? Dùng bảng nào? Điều gì có thể đánh lừa bạn?",
  "Saved only in this browser.": "Chỉ lưu trong trình duyệt này.", "Hints": "Hints", "Open only what you need": "Chỉ mở những gì bạn cần",
  "Hint 1 · A nudge": "Hint 1 · Gợi ý nhẹ", "Hint 2 · How to break it down": "Hint 2 · Cách chia nhỏ vấn đề", "Hypotheses to test": "Giả thuyết cần kiểm tra", "Hint 3 · What usually goes wrong": "Hint 3 · Lỗi hay gặp",
  "Suggested tables (pick yours, then check)": "Bảng gợi ý (chọn của bạn, rồi kiểm tra)", "Check my choice": "Kiểm tra lựa chọn",
  "Plan the approach →": "Lên approach →", "Solve it →": "Giải →", "← Back": "← Quay lại", "Reset this challenge": "Reset case này", "Click again to clear notes and progress": "Bấm lần nữa để xoá ghi chú và tiến độ",
  "Solve it": "Giải", "Visualize": "Visualize", "Dig one level deeper": "Đào sâu thêm một tầng", "Test it (statistics)": "Kiểm định (statistics)", "Conclude": "Kết luận",
  "Goal.": "Mục tiêu.", "Write the query yourself first. Open a hint only when you are stuck.": "Tự viết query trước. Chỉ mở hint khi bị kẹt.",
  "Hint · Grain and joins": "Hint · Grain và JOIN", "Hint · Query skeleton": "Hint · Khung query", "Expected T-SQL and output": "T-SQL mẫu và output", "Watch out": "Lưu ý",
  "Expected output": "Expected output", "(DuckDB run on the CSV files, with the exact query above)": "(DuckDB chạy trên file CSV, với đúng query ở trên)",
  "Your plan from step 2": "Plan của bạn từ bước 2", "You did not write a plan yet. Go back to step 2 and sketch one.": "Bạn chưa viết plan. Quay lại bước 2 và phác thảo một bản.",
  "Run in the editor": "Chạy trong editor", "Show table": "Hiện bảng", "Hide table": "Ẩn bảng",
  "Decide which chart you would build before you open ours.": "Hãy quyết định bạn sẽ dựng chart nào trước khi mở chart của chúng tôi.",
  "Show the suggested chart": "Xem chart gợi ý", "Show the suggested charts": "Xem các chart gợi ý", "Why this chart:": "Vì sao chọn chart này:",
  "Write three sentences: the call, the evidence with numbers, the action and one caveat.": "Viết ba câu: kết luận (the call), bằng chứng kèm con số, hành động đề xuất và một caveat.",
  "Show the model answer": "Xem model answer", "Self-check": "Tự chấm", "(tick when your answer does it)": "(tick khi câu trả lời của bạn đã làm được)", "✓ Case complete: {title}": "✓ Hoàn thành case: {title}",
  "Context done": "Xong Context", "You know the ask. Next, plan how you would answer it.": "Bạn đã nắm yêu cầu. Giờ hãy lên kế hoạch trả lời.",
  "Plan written": "Đã có plan", "You planned before touching the data. Now test it with SQL.": "Bạn đã lên plan trước khi đụng vào data. Giờ kiểm chứng bằng SQL.",
  "Case complete": "Hoàn thành case", "{title}. {n} of {m} cases done.": "{title}. Đã xong {n}/{m} case.",
  "This case uses the {name} database ({db}), which is too large to load here. Run its SQL in SQL Server. The expected query and output below show what you should get.": "Case này dùng database {name} ({db}), quá lớn để tải ở đây. Hãy chạy SQL trong SQL Server. Query mẫu và output bên dưới cho thấy kết quả bạn nên có.",
  "-- Write your T-SQL here. Table names match SQL Server.\n": "-- Viết T-SQL của bạn ở đây. Tên bảng giống SQL Server.\n",
  "This case is not translated yet, so it shows in English.": "Case này chưa có bản tiếng Việt nên đang hiển thị bằng tiếng Anh.",
  "selected, but ": "đã chọn, nhưng ", "missing. ": "thiếu. ", "✓ Right.": "✓ Đúng.", "✗ Not quite.": "✗ Chưa đúng.",
  "Language": "Ngôn ngữ",
  "{n} of {m} cases are open in the free Lab.": "{n}/{m} case được mở trong Lab miễn phí.",
};
