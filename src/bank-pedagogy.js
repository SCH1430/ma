// Local pedagogical metadata. Unknown skills stay unclassified; task text is never changed.
globalThis.MathBankPedagogy = (() => {
  'use strict';
  const rows = [
    ['operations','Соблюдать порядок действий',[],'Сначала выполните действия в скобках, затем степени, умножение и деление, после них сложение и вычитание. Действия одной ступени выполняйте слева направо.'],
    ['fractions','Выполнять действия с дробями',['operations'],'Для сложения нужен общий знаменатель. При умножении перемножают числители и знаменатели; сокращают общие множители.'],
    ['percent','Находить процент и исходную величину',['fractions'],'Уточните, какая величина принята за 100%. p% от a равны a · p / 100; при восстановлении целого делите часть на её долю.'],
    ['proportions','Составлять и решать пропорцию',['fractions'],'Сопоставьте одинаковые величины. В пропорции a/b = c/d при ненулевых знаменателях выполняется ad = bc.'],
    ['units','Переводить единицы измерения',['operations'],'Приведите величины к одинаковым единицам. При переходе к площади коэффициент перевода длины возводят в квадрат, к объёму — в куб.'],
    ['brackets','Раскрывать скобки',['operations'],'Умножьте каждый член в скобках на внешний множитель. Минус перед скобками меняет знак каждого слагаемого.'],
    ['linear-equation','Решать линейное уравнение',['operations'],'Выполняйте одинаковые действия с обеими частями уравнения. Приведите его к ax = b; при a ≠ 0 разделите на a и проверьте подстановкой.'],
    ['systems','Решать систему уравнений',['linear-equation'],'Исключите одну переменную сложением или подстановкой. Найденная пара должна удовлетворять каждому исходному уравнению.'],
    ['quadratic-equation','Решать квадратное уравнение',['linear-equation','radicals'],'Для ax² + bx + c = 0 при a ≠ 0 вычислите D = b² − 4ac. При D ≥ 0 корни равны (−b ± √D)/(2a); проверьте также возможность разложения на множители.'],
    ['domain','Учитывать область допустимых значений',[],'До преобразований выпишите ограничения: знаменатели не равны нулю, подкоренные выражения чётных корней неотрицательны, аргументы логарифмов положительны. Сохраните исходные ограничения.'],
    ['root-selection','Проверять и отбирать корни',['domain'],'Проверьте каждый найденный корень в исходном уравнении и ограничениях задачи. Если задан промежуток, отдельно проверьте его границы.'],
    ['powers','Применять свойства степеней',['operations'],'При умножении степеней с одинаковым основанием показатели складывают; при делении вычитают, а при возведении степени в степень — перемножают. Учитывайте допустимость основания.'],
    ['radicals','Преобразовывать квадратные корни',['powers'],'Арифметический квадратный корень неотрицателен. В частности, √(a²) = |a|; выносите из-под корня квадратные множители с учётом знака.'],
    ['graph-reading','Считывать значения с графика',[],'Проверьте подписи осей и масштаб. От заданного аргумента перейдите к графику и считайте соответствующую ординату; не путайте значение функции с её аргументом.'],
    ['function-value','Находить значение функции по формуле',['operations'],'Подставьте заданный аргумент вместо переменной в формулу функции. Учитывайте скобки, порядок действий и область определения.'],
    ['function-intersection','Находить пересечение графиков',['linear-equation'],'В точке пересечения аргумент и значение обеих функций совпадают. Приравняйте выражения для y, решите уравнение и найдите координаты точки.'],
    ['angles','Находить углы по геометрическим связям',[],'Укажите используемую связь: смежные углы дают 180°, вертикальные равны, сумма углов треугольника равна 180°. Не определяйте угол измерением схемы.'],
    ['pythagoras','Применять теорему Пифагора',['radicals'],'В прямоугольном треугольнике c² = a² + b², где c — гипотенуза. Для длины извлеките положительный квадратный корень; для катета вычитайте квадрат другого катета.'],
    ['area','Вычислять площадь фигуры',['operations'],'Выберите формулу для данной фигуры и нужную высоту. Например, S прямоугольника = ab, S треугольника = ah/2. Ответ измеряется в квадратных единицах.'],
    ['perimeter','Вычислять периметр',['operations'],'Периметр равен сумме длин всех сторон границы. Для прямоугольника P = 2(a + b); единицы периметра — единицы длины.'],
    ['volume','Вычислять объём тела',['area'],'Выберите формулу для тела: у призмы и цилиндра V = S основания · h, у пирамиды и конуса V = S основания · h / 3, у шара V = 4πR³/3.'],
    ['similarity','Использовать коэффициент подобия',['proportions','powers'],'При коэффициенте подобия k длины меняются в k раз, площади — в k², объёмы — в k³. Сначала определите, какое отношение спрашивают.'],
    ['mean','Находить среднее арифметическое',['operations'],'Сложите все значения и разделите сумму на число наблюдений. Если заданы частоты, каждое значение нужно учесть соответствующее число раз.'],
    ['median','Находить медиану',[],'Сначала упорядочьте значения. При нечётном количестве медиана — средний элемент, при чётном — среднее арифметическое двух центральных.'],
    ['probability','Считать равновозможные исходы',['fractions'],'Убедитесь, что исходы равновозможны. Вероятность события равна числу благоприятных исходов, делённому на общее число исходов.'],
    ['combinatorics','Подсчитывать варианты выбора',['operations'],'Определите, важен ли порядок и допускаются ли повторения. Для последовательных выборов используйте правило умножения, для непересекающихся случаев — сложение.'],
    ['derivative','Находить и применять производную',['function-value','powers'],'Сначала найдите производную по правилам дифференцирования. Для сложной функции учитывайте производную внутреннего выражения; для экстремума проверьте смену знака и границы.'],
    ['integral','Применять первообразную и интеграл',['derivative'],'Найдите первообразную F и проверьте её дифференцированием. Определённый интеграл равен F(b) − F(a); при вычислении площади учтите знак функции.'],
    ['sequences','Использовать формулы прогрессий',['operations'],'Для арифметической прогрессии aₙ = a₁ + (n − 1)d, для геометрической bₙ = b₁qⁿ⁻¹. Различайте номер члена, разность и знаменатель.'],
    ['logarithms','Применять определение логарифма',['powers','domain'],'logₐb = c означает aᶜ = b при a > 0, a ≠ 1, b > 0. Перед преобразованием проверьте ограничения основания и аргумента.'],
    ['trigonometry','Применять тригонометрические соотношения',[],'Уточните единицы угла, используйте табличные значения и тождества. В уравнении учитывайте периодичность, а затем ограничения задачи.'],
    ['counterexample','Опровергать утверждение контрпримером',[],'Для опровержения общего утверждения достаточно одного допустимого примера, в котором заключение неверно. Проверьте все условия утверждения для своего примера.'],
    ['justification','Обосновывать вывод',[],'Назовите используемое свойство и объясните, почему его условия выполнены. Каждый переход должен следовать из условия или уже доказанного факта.'],
    ['error-analysis','Находить ошибку в рассуждении',[],'Проверяйте переходы по порядку. Найдите первый неверный переход, объясните нарушенное правило и исправьте дальнейшее решение.'],
    ['method-comparison','Сравнивать способы решения',[],'Проверьте корректность обоих способов, сравните число действий и ограничения. Объясните, какой способ удобнее в данном условии и почему.'],
    ['circle','Использовать радиус и диаметр окружности',['operations'],'Радиус соединяет центр с точкой окружности; все радиусы одной окружности равны. Диаметр вдвое больше радиуса.'],
    ['remainder','Делить с остатком',['operations'],'Запишите a=bq+r и проверьте 0≤r<b. Для количества упаковок различайте полные группы и округление вверх.'],
    ['time','Вычислять промежутки времени',['units'],'Приведите часы и минуты к одной единице. Учитывайте переход через полночь и указанные даты.'],
    ['divisibility','Использовать признаки делимости',['operations'],'Проверьте нужный признак и совместимость нескольких условий. Для доказательства используйте разрядную запись или остатки.'],
    ['gcd-lcm','Находить НОД и НОК',['divisibility'],'НОД делит оба числа; НОК делится на оба. Различайте максимальный общий размер группы и первый общий период.'],
    ['integer-line','Работать с координатной прямой',['operations'],'Знак задаёт направление, модуль — расстояние. Сравнивайте числа по положению слева направо.'],
    ['absolute-value','Раскрывать модуль и находить расстояния',['integer-line'],'Модуль неотрицателен. В уравнении |x−a|=r при r>0 учитывайте точки по обе стороны от a.'],
    ['symmetry','Строить отражение относительно прямой',['coordinates'],'Ось проходит через середину отрезка между точкой и образом и перпендикулярна ему. Сохраняйте расстояние до оси.'],
    ['coordinates','Использовать координаты точек',['operations'],'Вычисляйте разности координат и средние по каждой оси отдельно. Для расстояния используйте сумму квадратов разностей.'],
    ['polynomials','Делить многочлены и связывать корни',['brackets'],'Остаток при делении на x−a равен P(a). В формулах Виета учитывайте старший коэффициент и знаки.'],
    ['conditional-probability','Вычислять условную вероятность',['probability'],'Ограничьте множество исходов условием. Разделите вероятность пересечения на положительную вероятность условия; обратное условие требует новой нормировки.'],
    ['integer-equation','Решать уравнения в целых числах',['divisibility'],'Проверьте делимость и остатки. При переборе докажите границы и полноту списка решений.'],
    ['parameters','Разбирать уравнения с параметром',['quadratic-equation'],'Выделите значения, при которых меняется степень или область определения. Для каждого случая проверьте число и допустимость корней.'],
    ['covariance','Вычислять ковариацию и линейную регрессию',['mean'],'Сопоставляйте наблюдения попарно. Уточните делитель n или n−1. Для регрессии и корреляции проверьте ненулевые дисперсии.'],
    ['estimation','Оценивать точность и округлять',['operations'],'Укажите разряд округления или целую границу. Абсолютная погрешность — модуль разности точного и приближённого значений.']
  ];
  const definitions = Object.freeze(rows.map(([id,title,prerequisites,explanation]) => Object.freeze({id,title,prerequisites:Object.freeze(prerequisites),explanation})));
  const known = new Map(definitions.map(item => [item.id,item]));
  const text = value => typeof value === 'string' ? value.trim() : '';
  const normalize = ids => {
    const selected = new Set(Array.isArray(ids) ? ids : []);
    return definitions.filter(item => selected.has(item.id)).map(item => item.id);
  };
  const familyKey = q => text(q?.family) || text(q?.subtypeId) || text(q?.canonicalId) || text(q?.id);
  const canonicalKey = q => text(q?.canonicalId) || text(q?.id);
  const modelSkills = {
    arithmetic:['operations'], division:['operations'], fractions:['fractions'], decimals:['operations'],
    percent:['percent'], ratio:['proportions'], scale:['proportions','units'], signed:['operations'],
    linear:['linear-equation'], powers:['powers'], polynomial:['brackets'], systems:['systems'],
    triangle:['angles'], angles:['angles'], rectangle:['area'], perimeter:['perimeter'],
    radicals:['radicals'], quadratic:['quadratic-equation'], rational:['domain'], pythagoras:['pythagoras'],
    trapezoid:['area'], similarity:['similarity'], volume_scale:['similarity'], inscribed_angle:['angles'],
    probability:['probability'], arithmetic_sequence:['sequences'], geometric_sequence:['sequences'],
    biquadratic:['quadratic-equation','root-selection'], cosine_rule:['trigonometry'],
    combinations:['combinatorics'], nth_root:['powers'], irrational_equation:['domain','root-selection'],
    trig_value:['trigonometry'], trig_equation:['trigonometry','root-selection'], logarithms:['logarithms'],
    exponential:['powers'], derivative:['derivative'], integral:['integral'], advanced_integral:['integral'],
    logarithmic_inequality:['logarithms','domain'], optimization:['derivative'], trig_inequality:['trigonometry']
  };
  function forTask(q) {
    if (!q || typeof q !== 'object') return [];
    const reviewed=typeof QUALITY_BANK!=='undefined'?QUALITY_BANK.legacySkills?.[q.id]:null;
    if(reviewed)return normalize(reviewed.skills);
    // Explicit editorial metadata, including an empty list, always wins.
    if (Array.isArray(q.skills)) return normalize(q.skills);
    const p = text(q.prompt || q.text).toLowerCase().replace(/ё/g,'е');
    const model = text(q.generation?.model), form = q.generation?.form;
    const skills = new Set(modelSkills[model] || []);
    const add = (id, condition) => { if (condition) skills.add(id); };
    add('brackets', model === 'linear' && form === 1 || /раскро(?:йте|й|ем|ют).*скоб|раскрыть скоб/.test(p) || /(?:\d|[−-])\s*\([^)]*[xyаab][^)]*\)/.test(p) && /уравнен|упрост|коэффициент/.test(p));
    add('linear-equation', /решите (?:линейное )?уравнение/.test(p) && /[xy]/.test(p) && !/[²³⁴^√]|корень из|логарифм|log|ln\s*\(|sin|cos|tg|модул|\||знаменатель|\/\s*[−-]?\s*(?:\([^)]*)?[xy]|[xy]\s*(?:[·*×]\s*)?\(|\)\s*(?:[·*×]\s*)?\(|[xy]\s*[·*×]\s*[xy]/.test(p));
    add('systems', /решите систем[уы]/.test(p) && /=/.test(p));
    add('quadratic-equation', /решите (?:квадратное )?уравнение/.test(p) && /x²|x\^2/.test(p) && !/[³⁴√]|x\^[^2]|\/|корень из|знаменатель|sin|cos/.test(p));
    add('fractions', /дроб/.test(p) && /слож|сумм|выч|разност|произвед|умнож|раздел|частно|сократ/.test(p) || /вычислите[^.?!]*\d\s*\/\s*\d[^.?!]*[+−·×]/.test(p));
    add('percent', /процент|скидк|\d\s*%/.test(p));
    add('proportions', /пропорци|масштаб/.test(p));
    add('units', /переведите|выразите[^.?!]*(?:метр|литр|грамм|секунд|минут)|сколько[^.?!]*(?:сантиметров в|метров в|литров в)/.test(p));
    add('domain', /област[ьи] (?:допустимых значений|определения)|одз|знаменател[^.?!]*(?:x|икс)|\/\s*[−-]?\s*(?:\([^)]*)?x/.test(p));
    add('root-selection', /посторонн[^.?!]*кор|провер(?:ьте|ить)[^.?!]*кор|отбер(?:ите|и)[^.?!]*кор|корн[^.?!]*(?:принадлеж|отрезк|промежут|интервал)|корень из[^.?!]*[xх]/.test(p));
    add('graph-reading', /(?:на рисунке|на чертеже|изображен|представлен)[^.?!]*график|по графику|считайте[^.?!]*график/.test(p));
    add('function-value', /(?:найдите|вычислите)[^.?!]*(?:значение функции|f\s*\([^x)]*\))/.test(p) || /функция задана[^.?!]*\.\s*найдите[^.?!]*значение/.test(p));
    add('function-intersection', /точк[аиуы] пересечения[^.?!]*(?:прям|график|парабол)|пересечени[ея] графиков/.test(p) || model === 'linear_function' && form === 1);
    add('angles', /(?:найдите|определите)[^.?!]*\sуг(?:ол|ла|лы|лов|лу)(?=[\s.,:;?!]|$)|третий угол/.test(p));
    add('pythagoras', /катет|гипотенуз|теорем[уы] пифагор/.test(p) && /найдите[^.?!]*(?:катет|гипотенуз)|катеты[^.?!]*равны/.test(p));
    add('area', /(?:найдите|вычислите|определите)[^.?!]*площад|площадь[^.?!]*(?:равна|равен)[^.?!]*найдите/.test(p));
    add('perimeter', /(?:найдите|вычислите|определите)[^.?!]*периметр/.test(p));
    add('volume', /(?:найдите|вычислите|определите)[^.?!]*(?:объем|вместимость)/.test(p));
    add('similarity', /коэффициент подобия|подобных (?:треугольников|фигур|тел)|линейные размеры[^.?!]*(?:увелич|уменьш)/.test(p));
    add('mean', model === 'statistics' && form === 0 || /(?:найдите|вычислите|определите)[^.?!]*среднее арифметическое/.test(p));
    add('median', model === 'statistics' && form === 1 || /(?:найдите|вычислите|определите)[^.?!]*медиан[уы][^.?!]*(?:выборк|набор|чисел)|(?:выборка|набор|числа)[^.?!]*\.\s*найдите[^.?!]*медиан/.test(p));
    add('probability', /равновозможн/.test(p) && /вероятност/.test(p));
    add('combinatorics', /сколькими способами|число сочетаний|число перестановок/.test(p));
    add('derivative', /производн/.test(p));
    add('integral', /первообразн|интеграл|∫/.test(p));
    add('sequences', /арифметическ[^.?!]*прогресс|геометрическ[^.?!]*прогресс/.test(p));
    add('logarithms', /логарифм|log[₀-₉ₓ_(]|ln\s*\(/.test(p));
    add('trigonometry', /тригонометр|sin|cos|tg\s*|синус|косинус|тангенс/.test(p));
    add('counterexample', /контрпример|опровергните/.test(p));
    add('justification', /обоснуйте|докажите|объясните,? почему/.test(p));
    add('error-analysis', /найдите ошибку|исправьте ошибку|первый неверный/.test(p));
    add('method-comparison', /сравните[^.?!]*способ|сравните[^.?!]*метод/.test(p));
    return normalize([...skills]);
  }
  function matches(q, ids) {
    if (!Array.isArray(ids)) return false;
    if (!ids.length) return true;
    const selected = normalize(ids);
    return selected.length > 0 && forTask(q).some(id => selected.includes(id));
  }
  const difficultyRank = q => ({'Базовый':0,'Средний':1,'Повышенный':2,'Высокий':3,'Суперсложный':3})[q?.difficulty] ?? 4;
  function coverage(tasks) {
    const groups = new Map(), seen = new Set();
    for (const q of Array.isArray(tasks) ? tasks : []) {
      if (!q || !text(q.id) || seen.has(q.id)) continue;
      seen.add(q.id);
      const topic = text(q.topicId) || text(q.subtypeId) || (q.examId ? `${q.examId}:${q.number ?? ''}` : 'unclassified');
      const source = text(q.source) || 'class', id = `${source}:${topic}:${q.grade ?? ''}:${q.level ?? ''}`;
      if (!groups.has(id)) groups.set(id,{id,topicId:topic,title:text(q.topic) || (q.examId ? `${text(q.sourceLabel) || q.examId} · № ${q.number ?? '?'}` : 'Без темы'),grade:q.grade ?? null,level:q.level ?? null,source,count:0,familySet:new Set(),taggedSet:new Set(),unclassified:0,difficulties:{},open:0,skills:new Set()});
      const row = groups.get(id);
      row.count++;
      row.familySet.add(familyKey(q));
      if (text(q.family) || text(q.subtypeId)) row.taggedSet.add(familyKey(q)); else row.unclassified++;
      const difficulty = text(q.difficulty) || 'Не размечено';
      row.difficulties[difficulty] = (row.difficulties[difficulty] || 0) + 1;
      if (q.kind === 'open') row.open++;
      for (const skill of forTask(q)) row.skills.add(skill);
    }
    return [...groups.values()].map(({familySet,taggedSet,skills,...row}) => {
      const gaps = [];
      if (!row.open) gaps.push('Нет заданий с развёрнутым рассуждением');
      if (!row.difficulties['Базовый']) gaps.push('Нет базового уровня');
      if (!['Повышенный','Высокий','Суперсложный'].some(level => row.difficulties[level])) gaps.push('Нет повышенного или высокого уровня');
      if (taggedSet.size < 2) gaps.push('Менее двух размеченных семейств');
      if (row.unclassified) gaps.push(`Без разметки семейства: ${row.unclassified}`);
      if (!skills.size) gaps.push('Конкретные навыки пока не размечены');
      return {...row,families:familySet.size,taggedFamilies:taggedSet.size,skills:[...skills],gaps};
    }).sort((a,b) => (a.grade ?? 99) - (b.grade ?? 99) || a.title.localeCompare(b.title,'ru') || a.id.localeCompare(b.id));
  }
  function recovery(q,pool,options={}) {
    options = options && typeof options === 'object' ? options : {};
    const ids = forTask(q), excluded = new Set([q?.id,...(Array.isArray(options.excludeIds) ? options.excludeIds : [])]);
    const canonical = new Set([canonicalKey(q)]), candidates = [], seen = new Set();
    for (const task of Array.isArray(pool) ? pool : []) {
      if (!task || !text(task.id) || excluded.has(task.id) || seen.has(task.id) || canonical.has(canonicalKey(task))) continue;
      seen.add(task.id);
      if (Number.isFinite(q?.grade) && Number.isFinite(task.grade) && task.grade > q.grade) continue;
      if (q?.level === 'basic' && task.level === 'advanced') continue;
      const skills = forTask(task);
      if (ids.some(id => skills.includes(id))) candidates.push({task,skills});
    }
    const preferred = ids.includes(options.skillId) ? options.skillId : (modelSkills[text(q?.generation?.model)] || []).find(id => ids.includes(id));
    const best = ids.map(id => ({id,count:candidates.filter(row => row.skills.includes(id)).length})).sort((a,b) => Number(b.id===preferred)-Number(a.id===preferred) || b.count-a.count)[0];
    if (!best) return {skillId:null,explanation:'Для этого задания конкретный навык пока не размечен. Можно вернуться к разбору исходного задания.',simple:null,practice:null,missing:['skill','simple','practice']};
    const compare = (a,b) => {
      const sameTopic = task => !!q?.topicId && task.topicId === q.topicId;
      return Number(sameTopic(b))-Number(sameTopic(a)) || Number(b.grade===q?.grade)-Number(a.grade===q?.grade) || a.id.localeCompare(b.id);
    };
    const matches = candidates.filter(row => row.skills.includes(best.id)).map(row => row.task);
    // A harder task is never presented as a simple recovery check.
    const simple = matches.filter(task => difficultyRank(task) <= Math.min(1,difficultyRank(q))).sort((a,b) => difficultyRank(a)-difficultyRank(b) || compare(a,b))[0] || null;
    const practice = matches.filter(task => (!simple || canonicalKey(task) !== canonicalKey(simple)) && difficultyRank(task) <= difficultyRank(q)).sort((a,b) => compare(a,b) || Math.abs(difficultyRank(a)-difficultyRank(q))-Math.abs(difficultyRank(b)-difficultyRank(q)))[0] || null;
    return {skillId:best.id,explanation:known.get(best.id).explanation,simple,practice,missing:[...(!simple?['simple']:[]),...(!practice?['practice']:[])]};
  }
  return Object.freeze({definitions,normalize,forTask,matches,familyKey,coverage,recovery});
})();
