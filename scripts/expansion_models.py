"""Reviewed parameter families for the October 2026 practice-bank expansion.

Each model constructs a solution and supplies a separate condition-based oracle.
Numeric variants share a family ID; they are not counted as independent ideas.
"""
from fractions import Fraction as F
from math import comb, factorial, gcd, sqrt, exp, floor


def fmt(value):
    if isinstance(value, F):
        return str(value.numerator) if value.denominator == 1 else f'{value.numerator}/{value.denominator}'
    return f'{value:g}' if isinstance(value, float) else str(value)


def make(prompt, answer, solution, oracle, tags, difficulty='Средний', precision=None):
    values = answer if isinstance(answer, list) else [answer]
    stored = [float(x) if isinstance(x, F) else x for x in values]
    out = dict(prompt=prompt, answer=stored if isinstance(answer, list) else stored[0],
               display='; '.join(map(fmt, values)) if values else '∅', solution=solution,
               oracle=oracle, kind='set' if isinstance(answer, list) else 'number',
               difficulty=difficulty, competencies=tags.split())
    if precision:
        out['precision'] = precision
    return out


def arithmetic(n, form):
    a,b,c=n+12,n%7+3,n%5+2
    if form == 0:
        value=(a+b)*c-a*c
        return make(f'Найдите значение ({a} + {b}) · {c} − {a} · {c}.',value,
                    f'Вынесем {c} за скобки: ({a} + {b} − {a}) · {c} = {b} · {c} = {value}.',
                    f'({a}+{b})*{c}-{a}*{c}','calculations','Базовый')
    value=(a*c+b*c)//c
    return make(f'Вычислите ({a*c} + {b*c}) : {c}, разделив каждое слагаемое.',value,
                f'{a*c} : {c} + {b*c} : {c} = {a} + {b} = {value}.',
                f'F({a*c}+{b*c},{c})','calculations','Базовый')


def division(n, form):
    divisor=n%13+4;q=n+17;r=n%(divisor-1)+1
    number=divisor*q+r
    if form == 0:
        return make(f'Число {number} разделили на {divisor} с остатком. Найдите неполное частное.',q,
                    f'{number} = {divisor} · {q} + {r}, причём 0 ≤ {r} < {divisor}. Неполное частное равно {q}.',
                    f'{number}//{divisor}','calculations','Базовый')
    return make(f'В наборе помещается {divisor} карандашей. Для класса нужно {number} карандашей. Какое наименьшее число полных наборов надо купить?',q+1,
                f'{q} наборов содержат {q*divisor} карандашей: не хватает {r}. Покупаем ещё один набор, всего {q+1}.',
                f'ceil(F({number},{divisor}))','modelling','Средний')


def fractions(n, form):
    d=n+7;a=n%5+1;b=n%4+2
    if form == 0:
        value=F(a,d)+F(b,2*d)
        return make(f'Вычислите {a}/{d} + {b}/{2*d}. Ответ запишите несократимой дробью.',value,
                    f'Общий знаменатель {2*d}: ({2*a} + {b})/{2*d} = {fmt(value)}.',
                    f'F({a},{d})+F({b},{2*d})','calculations','Базовый')
    value=F(a,d)*F(d+1,b)
    return make(f'Найдите произведение {a}/{d} и {d+1}/{b}. Сократите результат.',value,
                f'Перемножим числители и знаменатели: {a*(d+1)}/{d*b}. После сокращения получаем {fmt(value)}.',
                f'F({a},{d})*F({d+1},{b})','calculations','Средний')


def decimals(n, form):
    a=10*n+23;b=3*n+7
    if form == 0:
        value=F(a+b,100)
        return make(f'Сложите десятичные дроби {a/100:.2f} и {b/100:.2f}.',value,
                    f'Запишем обе дроби в сотых: ({a} + {b})/100 = {fmt(value)}.',
                    f'F({a},100)+F({b},100)','calculations','Базовый')
    k=n%7+2;value=F(a*k,100)
    return make(f'Один метр ленты стоит {a/100:.2f} рубля. Сколько рублей стоят {k} метров?',value,
                f'Стоимость равна цене, умноженной на длину: ({a}/100) · {k} = {fmt(value)} рубля.',
                f'F({a},100)*{k}','modelling','Средний')


def shopping(n, form):
    price=n+18;count=n%8+3;other=n+7;qty=n%5+2
    cost=price*count+other*qty
    if form == 0:
        paid=cost+10*(n+1)
        return make(f'Купили {count} тетрадей по {price} рублей и {qty} ручек по {other} рублей. Заплатили {paid} рублей. Найдите сдачу.',paid-cost,
                    f'Покупка стоит {count} · {price} + {qty} · {other} = {cost} рублей. Сдача: {paid} − {cost} = {paid-cost} рублей.',
                    f'{paid}-({count}*{price}+{qty}*{other})','modelling','Средний')
    return make(f'За {count} одинаковых тетрадей и ручку ценой {other} рублей заплатили {price*count+other} рублей. Сколько рублей стоит одна тетрадь?',price,
                f'Тетради стоят {price*count+other} − {other} = {price*count} рублей. Одна тетрадь: {price*count} : {count} = {price} рублей.',
                f'F({price*count+other}-{other},{count})','modelling','Средний')


def motion(n, form):
    v=n+34;u=n%12+18;t=n%5+2
    if form == 0:
        distance=(v+u)*t
        return make(f'Из двух городов навстречу друг другу одновременно выехали автомобили со скоростями {v} и {u} км/ч. Расстояние между городами {distance} км. Через сколько часов они встретятся?',t,
                    f'Скорость сближения {v} + {u} = {v+u} км/ч. Время: {distance} : {v+u} = {t} ч.',
                    f'F({distance},{v}+{u})','modelling','Средний')
    distance=v*t+u*(t+1)
    return make(f'Автобус ехал {t} ч со скоростью {v} км/ч, затем ещё {t+1} ч со скоростью {u} км/ч. Какой путь в километрах он проехал?',distance,
                f'Первый участок: {v} · {t} = {v*t} км; второй: {u} · {t+1} = {u*(t+1)} км. Всего {distance} км.',
                f'{v}*{t}+{u}*{t+1}','modelling','Средний')


def perimeter(n, form):
    a=n+7;b=n%9+3
    if form == 0:
        return make(f'Периметр прямоугольной клумбы {2*(a+b)} м, её длина {a} м. Найдите ширину в метрах.',b,
                    f'Сумма длины и ширины равна половине периметра: {a+b} м. Ширина: {a+b} − {a} = {b} м.',
                    f'F({2*(a+b)},2)-{a}','geometry','Средний')
    k=n%4+2;value=2*k
    return make(f'У прямоугольника стороны {a} см и {b} см. Длину увеличили на {k} см, ширину сохранили. На сколько сантиметров увеличился периметр?',value,
                f'Увеличились две противоположные стороны, каждая на {k} см. Прибавка периметра равна 2 · {k} = {value} см.',
                f'2*({a}+{k}+{b})-2*({a}+{b})','geometry','Средний')


def rectangle(n, form):
    a=n+9;b=n%8+4;k=n%3+1
    if form == 0:
        return make(f'Площадь прямоугольной площадки {a*b} м², одна сторона {a} м. Найдите другую сторону в метрах.',b,
                    f'Площадь равна произведению сторон. Неизвестная сторона: {a*b} : {a} = {b} м.',
                    f'F({a*b},{a})','geometry','Базовый')
    value=a*b-k*k
    return make(f'Из прямоугольного листа {a} см на {b} см вырезали квадрат со стороной {k} см. Найдите площадь оставшейся части в см².',value,
                f'Площадь листа {a*b} см², площадь выреза {k*k} см². Осталось {a*b} − {k*k} = {value} см².',
                f'{a}*{b}-{k}**2','geometry','Средний')


def box(n, form):
    a=n+4;b=n%6+3;c=n%5+2
    if form == 0:
        return make(f'Прямоугольный контейнер имеет длину {a} дм, ширину {b} дм и высоту {c} дм. Найдите его вместимость в литрах.',a*b*c,
                    f'Объём {a} · {b} · {c} = {a*b*c} дм³. Один кубический дециметр равен одному литру, значит вместимость {a*b*c} л.',
                    f'{a}*{b}*{c}','geometry','Базовый')
    value=2*(a*b+a*c+b*c)
    return make(f'Найдите площадь полной поверхности прямоугольного параллелепипеда с рёбрами {a}, {b} и {c} см. Ответ дайте в см².',value,
                f'Три пары граней имеют площади {a*b}, {a*c} и {b*c} см². Полная поверхность: 2 · ({a*b} + {a*c} + {b*c}) = {value} см².',
                f'2*({a}*{b}+{a}*{c}+{b}*{c})','geometry','Средний')


def angles(n, form):
    a=21+n%120
    if form == 0:
        return make(f'Луч делит развёрнутый угол на два угла. Один равен {a}°. Найдите другой угол в градусах.',180-a,
                    f'Развёрнутый угол равен 180°. Второй угол: 180 − {a} = {180-a}°.',
                    f'180-{a}','geometry','Базовый')
    d=2*(n%60+1);small=(180-d)//2
    return make(f'Один из двух смежных углов на {d}° больше другого. Найдите меньший угол в градусах.',small,
                f'Пусть меньший угол x. Тогда x + (x + {d}) = 180, поэтому 2x = {180-d} и x = {small}°.',
                f'F(180-{d},2)','geometry equations','Средний')


def table_data(n, form):
    values=[n+12,2*n+5,n+9,3*n+2]
    if form == 0:
        return make(f'В библиотеку за четыре дня принесли соответственно {values[0]}, {values[1]}, {values[2]} и {values[3]} книг. Сколько книг принесли за все четыре дня?',sum(values),
                    f'Сложим данные за каждый день: {" + ".join(map(str,values))} = {sum(values)} книг.',
                    f'sum({values})','data','Базовый')
    value=max(values)-min(values)
    return make(f'Число посетителей выставки за четыре часа: {values[0]}, {values[1]}, {values[2]}, {values[3]}. На сколько максимальное число посетителей больше минимального?',value,
                f'Максимум {max(values)}, минимум {min(values)}. Разность равна {max(values)} − {min(values)} = {value}.',
                f'max({values})-min({values})','data','Средний')


def gcd_lcm(n, form):
    k=n+2;a=12*k;b=18*k
    if form == 0:
        return make(f'Найдите наибольший общий делитель чисел {a} и {b}.',6*k,
                    f'{b} − {a} = {6*k}; оба исходных числа делятся на {6*k}. После деления получаем взаимно простые числа 2 и 3. НОД равен {6*k}.',
                    f'gcd({a},{b})','calculations','Базовый')
    return make(f'Два сигнала повторяются каждые {a} и {b} секунд. Сейчас они прозвучали одновременно. Через сколько секунд они впервые совпадут снова?',36*k,
                f'Нужно наименьшее общее кратное. НОД({a}, {b}) = {6*k}, поэтому НОК = {a} · {b} : {6*k} = {36*k} с.',
                f'lcm({a},{b})','calculations modelling','Средний')


def percent(n, form):
    base=100*(n+4);p=5*(n%8+1)
    if form == 0:
        value=base*(100-p)//100
        return make(f'Цена куртки была {base} рублей. Её снизили на {p}%. Какой стала цена?',value,
                    f'После скидки остаётся {100-p}% цены: {base} · {100-p}/100 = {value} рублей.',
                    f'{base}*(1-F({p},100))','modelling calculations','Средний')
    amount=base*p//100
    return make(f'{p}% всех саженцев составляют {amount} яблонь. Сколько всего саженцев?',base,
                f'Один процент составляет {amount}/{p} саженцев. Всё количество: {amount} · 100 : {p} = {base}.',
                f'F({amount}*100,{p})','modelling equations','Средний')


def ratio(n, form):
    a=n%7+2;b=n%5+3;k=n+5;total=(a+b)*k
    if form == 0:
        return make(f'{total} кг смеси состоят из риса и гречки в отношении {a}:{b}. Сколько килограммов риса в смеси?',a*k,
                    f'Всего {a+b} равных частей. Одна часть: {total} : {a+b} = {k} кг; риса {a} · {k} = {a*k} кг.',
                    f'F({total}*{a},{a}+{b})','modelling calculations','Средний')
    return make(f'За {a} одинаковых блокнотов заплатили {a*k} рублей. Сколько рублей стоят {b} таких блокнотов?',b*k,
                f'Один блокнот стоит {a*k} : {a} = {k} рублей. За {b} блокнотов заплатят {b} · {k} = {b*k} рублей.',
                f'F({a*k},{a})*{b}','modelling','Базовый')


def signed(n, form):
    a=n+8;b=n%7+2;c=n%5+3
    if form == 0:
        value=-a*b+c
        return make(f'Вычислите (−{a}) · {b} + {c}.',value,
                    f'Произведение чисел разных знаков отрицательно: −{a*b}. Прибавим {c}: получаем {value}.',
                    f'(-{a})*{b}+{c}','calculations','Базовый')
    value=a*b-a*c
    return make(f'Найдите значение (−{a}) · (−{b}) − {a} · {c}.',value,
                f'Первое произведение положительно и равно {a*b}. Второе равно {a*c}. Разность: {a*b} − {a*c} = {value}.',
                f'(-{a})*(-{b})-{a}*{c}','calculations','Средний')


def absolute(n, form):
    a=n+5;b=n%9+2
    if form == 0:
        return make(f'На координатной прямой отмечены точки с координатами −{a} и {b}. Найдите расстояние между ними.',a+b,
                    f'Точки лежат по разные стороны от нуля. Расстояние равно {a} + {b} = {a+b}.',
                    f'abs({b}-(-{a}))','calculations geometry','Базовый')
    return make(f'Решите уравнение |x − {a}| = {b}. Укажите все корни.',[a-b,a+b],
                f'Возможны x − {a} = {b} и x − {a} = −{b}. Отсюда x = {a+b} или x = {a-b}.',
                f'sorted([{a}-{b},{a}+{b}])','equations','Средний')


def coordinates(n, form):
    a=n+3;b=n%11+2;c=n%7+1
    if form == 0:
        return make(f'Точку A({a}; −{b}) отразили относительно оси ординат. Найдите абсциссу полученной точки.',-a,
                    f'При отражении относительно оси ординат меняется знак абсциссы, а ордината сохраняется. Получаем A′(−{a}; −{b}), абсцисса −{a}.',
                    f'0-{a}','geometry','Базовый')
    return make(f'Точка A(−{a}; {b}) перемещена на {c} единиц вправо и на {b+2} единиц вниз. Найдите сумму координат новой точки.',-a+c-2,
                f'Новые координаты: x = −{a} + {c} = {-a+c}, y = {b} − {b+2} = −2. Их сумма {-a+c-2}.',
                f'(-{a}+{c})+({b}-{b+2})','geometry calculations','Средний')


def scale(n, form):
    a=n+3;k=n%9+2
    if form == 0:
        return make(f'На карте масштаба 1:{100000*k} расстояние между пунктами равно {a} см. Найдите настоящее расстояние в километрах.',a*k,
                    f'Одному сантиметру карты соответствуют {100000*k} см, то есть {k} км. Поэтому расстояние {a} · {k} = {a*k} км.',
                    f'F({a}*{100000*k},100000)','modelling geometry','Средний')
    return make(f'Дорога длиной {a*k} км на карте изображена отрезком {a} см. Найдите знаменатель масштаба карты.',100000*k,
                f'{a*k} км = {a*k*100000} см. Разделив на {a} см карты, получаем масштаб 1:{100000*k}.',
                f'F({a*k}*100000,{a})','modelling geometry','Повышенный')


def work_rate(n, form):
    a=n+3;b=n%7+2;total=a*b*(a+b)
    if form == 0:
        return make(f'Одна машина производит {a} деталей в минуту, другая {b}. За сколько минут совместной работы они изготовят {total} деталей?',a*b,
                    f'За минуту обе машины делают {a+b} деталей. Время: {total} : {a+b} = {a*b} минут.',
                    f'F({total},{a}+{b})','modelling','Средний')
    x=2*(n+3);y=3*(n+3);value=F(x*y,x+y)
    return make(f'Первый насос заполняет резервуар за {x} ч, второй за {y} ч. За сколько часов они заполнят его вместе, если производительности постоянны?',value,
                f'За час насосы заполняют 1/{x} + 1/{y} резервуара. Время равно 1 : (1/{x} + 1/{y}) = {fmt(value)} ч.',
                f'1/(F(1,{x})+F(1,{y}))','modelling equations','Повышенный')


def linear(n, form):
    a=n%9+2;r=n+4;b=n%13+5
    if form == 0:
        rhs=a*r+b
        return make(f'Решите уравнение {a}x + {b} = {rhs}.',r,
                    f'Перенесём свободное слагаемое: {a}x = {rhs-b}. Разделим на {a}: x = {r}.',
                    f'F({rhs}-{b},{a})','equations','Базовый')
    c=a+2;rhs=(a-c)*r-a*b
    return make(f'Решите уравнение {a}(x − {b}) = {c}x − {-rhs}.',r,
                f'Раскроем скобки: {a}x − {a*b} = {c}x − {-rhs}. Получаем ({a} − {c})x = {rhs+a*b}, откуда x = {r}.',
                f'F({rhs}+{a}*{b},{a}-{c})','equations','Средний')


def powers(n, form):
    a=n%8+2;p=n%5+2;q=n//5+2
    if form == 0:
        return make(f'Выражение {a}^{p} · {a}^{q} записали в виде {a}^k. Найдите k.',p+q,
                    f'При умножении степеней с одинаковым основанием показатели складываются: k = {p} + {q} = {p+q}.',
                    f'{p}+{q}','calculations','Базовый')
    return make(f'Упростите ({a}^{p})^{q} : {a}^{p} и запишите результат как {a}^k. Найдите k.',p*q-p,
                f'Степень степени даёт показатель {p} · {q}; при делении вычитаем {p}. Получаем k = {p*q-p}.',
                f'{p}*{q}-{p}','calculations','Средний')


def polynomial(n, form):
    a=n+3;b=n%9+2
    if form == 0:
        return make(f'Раскройте скобки (x + {a})(x − {b}). Найдите коэффициент при x.',a-b,
                    f'Произведение равно x² + ({a} − {b})x − {a*b}. Коэффициент при x равен {a-b}.',
                    f'{a}-{b}','calculations','Средний')
    x=n%5+1;value=2*a*x
    return make(f'Найдите значение (x + {a})² − x² − {a*a} при x = {x}.',value,
                f'Раскрыв квадрат суммы и сократив одинаковые слагаемые, получаем {2*a}x. При x = {x} значение равно {value}.',
                f'({x}+{a})**2-{x}**2-{a*a}','calculations','Средний')


def linear_function(n, form):
    k=n%8+2;b=n+5;x=n%7+1
    if form == 0:
        return make(f'Функция задана формулой y = {k}x − {b}. При каком x значение y равно {k*x-b}?',x,
                    f'Подставим y: {k*x-b} = {k}x − {b}. Тогда {k}x = {k*x}, поэтому x = {x}.',
                    f'F({k*x-b}+{b},{k})','graphs equations','Базовый')
    other=k+2;c=b-2*x
    return make(f'Найдите абсциссу точки пересечения прямых y = {k}x + {b} и y = {other}x + {c}.',x,
                f'Приравняем значения функций: {k}x + {b} = {other}x + {c}. Отсюда 2x = {b-c} и x = {x}.',
                f'F({b}-{c},{other}-{k})','graphs equations','Средний')


def systems(n, form):
    x=n+2;y=n%7+3
    if form == 0:
        return make(f'Решите систему x + y = {x+y}, x − y = {x-y}. В ответе укажите x.',x,
                    f'Сложив уравнения, получаем 2x = {2*x}. Следовательно, x = {x}; тогда y = {y}.',
                    f'F({x+y}+({x-y}),2)','equations','Средний')
    return make(f'Решите систему 2x + y = {2*x+y}, x + 3y = {x+3*y}. В ответе укажите y.',y,
                f'Из первого уравнения y = {2*x+y} − 2x. Подстановка во второе даёт −5x = {-5*x}, значит x = {x}, y = {y}.',
                f'solve2(2,1,1,3,{2*x+y},{x+3*y})[1]','equations','Повышенный')


def triangle(n, form):
    a=26+n%49;b=37+n%31
    if form == 0:
        value=180-a-b
        return make(f'Два угла треугольника равны {a}° и {b}°. Найдите третий угол в градусах.',value,
                    f'Сумма углов треугольника равна 180°. Третий угол: 180 − {a} − {b} = {value}°.',
                    f'180-{a}-{b}','geometry','Базовый')
    top=2*(n%65+10);base=(180-top)//2
    return make(f'В равнобедренном треугольнике угол между равными сторонами равен {top}°. Найдите внешний угол при основании в градусах.',180-base,
                f'Каждый угол при основании равен (180 − {top}) : 2 = {base}°. Смежный с ним внешний угол равен 180 − {base} = {180-base}°.',
                f'180-F(180-{top},2)','geometry','Средний')


def statistics(n, form):
    values=[n+2,n+7,n+4,n+9,n+3]
    if form == 0:
        value=F(sum(values),len(values))
        return make(f'Найдите среднее арифметическое чисел {", ".join(map(str,values))}.',value,
                    f'Сумма чисел равна {sum(values)}, количество равно 5. Среднее: {sum(values)}/5 = {fmt(value)}.',
                    f'mean({values})','data calculations','Базовый')
    return make(f'Дана выборка {", ".join(map(str,values))}. Найдите её медиану.',n+4,
                f'Упорядочим значения: {", ".join(map(str,sorted(values)))}. Средний, третий элемент равен {n+4}.',
                f'median({values})','data','Средний')


def frequency(n, form):
    total=20*(n+3);success=3*n+5
    if form == 0:
        value=F(success,total)
        return make(f'Из {total} проверенных деталей {success} оказались бракованными. Найдите относительную частоту брака.',value,
                    f'Относительная частота — отношение числа бракованных деталей к общему числу: {success}/{total} = {fmt(value)}.',
                    f'F({success},{total})','data calculations','Базовый')
    second=10*(n+2);s2=n+1;value=F(success+s2,total+second)
    return make(f'В первой серии из {total} опытов событие произошло {success} раз, во второй из {second} опытов — {s2} раз. Найдите частоту события в объединённой серии.',value,
                f'Всего {total+second} опытов и {success+s2} наступлений события. Частота равна {success+s2}/{total+second} = {fmt(value)}.',
                f'F({success}+{s2},{total}+{second})','data','Средний')


def graph_edges(n, form):
    count=n+5
    if form == 0:
        return make(f'В простом неориентированном графе {count} вершин, каждая соединена со всеми остальными. Сколько рёбер в графе?',count*(count-1)//2,
                    f'От каждой вершины выходит {count-1} рёбер. Каждое ребро подсчитано дважды, поэтому всего {count} · {count-1}/2 = {count*(count-1)//2}.',
                    f'comb({count},2)','data reasoning','Средний')
    return make(f'Дерево имеет {count} вершин. К нему добавили одну новую вершину, соединив её одним ребром с имеющейся. Сколько рёбер стало в дереве?',count,
                f'В исходном дереве {count-1} рёбер. Добавлено одно ребро, поэтому стало {count}. Связность сохраняется, цикла не возникает.',
                f'({count}-1)+1','data reasoning','Средний')


def radicals(n, form):
    a=n+4;b=n%7+2
    if form == 0:
        return make(f'Вычислите √{a*a} − √{b*b}.',a-b,
                    f'Арифметические квадратные корни равны {a} и {b}. Их разность {a-b}.',
                    f'sqrt({a*a})-sqrt({b*b})','calculations','Базовый')
    return make(f'Выражение √{2*a*a} − √{2*b*b} равно k√2. Найдите k.',a-b,
                f'Выносим квадратные множители: √{2*a*a} = {a}√2, √{2*b*b} = {b}√2. Коэффициент разности k = {a-b}.',
                f'(sqrt({2*a*a})-sqrt({2*b*b}))/sqrt(2)','calculations','Средний')


def quadratic(n, form):
    r=n+2;s=-(n%7+1);b=-(r+s);c=r*s
    if form == 0:
        return make(f'Решите уравнение x² + ({b})x + ({c}) = 0. Укажите все действительные корни.',sorted([r,s]),
                    f'Ищем числа с суммой {-b} и произведением {c}: это {r} и {s}. Получаем (x − {r})(x + {-s}) = 0, корни {s} и {r}.',
                    f'qroots(1,{b},{c})','equations','Средний')
    return make(f'Уравнение x² + ({b})x + ({c}) = 0 имеет два корня. Найдите сумму их квадратов.',r*r+s*s,
                f'По теореме Виета сумма корней {-b}, произведение {c}. Сумма квадратов равна ({-b})² − 2 · ({c}) = {r*r+s*s}.',
                f'sum(x*x for x in qroots(1,{b},{c}))','equations calculations','Повышенный')


def rational(n, form):
    a=n+3;x=a+n%5+2
    if form == 0:
        return make(f'Найдите значение (x² − {a*a})/(x − {a}) при x = {x}.',x+a,
                    f'Знаменатель не равен нулю. Числитель раскладывается как (x − {a})(x + {a}), поэтому значение равно {x} + {a} = {x+a}.',
                    f'F({x}**2-{a*a},{x}-{a})','calculations','Средний')
    return make(f'Решите уравнение {n+7}/(x − {a}) = {n+7}.',a+1,
                f'ОДЗ: x ≠ {a}. Делим на ненулевое число {n+7}: 1/(x − {a}) = 1. Получаем x − {a} = 1, x = {a+1}; ОДЗ выполнено.',
                f'{a}+F({n+7},{n+7})','equations','Средний')


def inequalities(n, form):
    a=n%8+2;b=n+5;r=n%11+3
    if form == 0:
        return make(f'Найдите наименьшее целое решение неравенства {a}x + {b} > {a*r+b}.',r+1,
                    f'После вычитания {b} и деления на положительное {a} получаем x > {r}. Наименьшее целое решение равно {r+1}.',
                    f'min(x for x in range(-100,101) if {a}*x+{b}>{a*r+b})','equations','Средний')
    low=n+2;high=low+n%7+4
    return make(f'Сколько целых чисел удовлетворяют системе x > {low}, x ≤ {high}?',high-low,
                f'Подходят числа от {low+1} до {high} включительно. Их количество: {high} − {low+1} + 1 = {high-low}.',
                f'len([x for x in range({low-1},{high+2}) if x>{low} and x<={high}])','equations','Средний')


def inverse_function(n, form):
    x=n+3;y=n%9+2;k=x*y
    if form == 0:
        return make(f'График y = k/x проходит через точку ({x}; {y}). Найдите k.',k,
                    f'Подставляем координаты: {y} = k/{x}. Умножаем на {x}: k = {x*y}.',
                    f'{x}*{y}','graphs','Базовый')
    return make(f'Функция задана формулой y = {k}/x. Найдите положительную абсциссу точки графика с ординатой {y}.',x,
                f'Решаем {y} = {k}/x. При x ≠ 0 получаем {y}x = {k}, x = {x}.',
                f'F({k},{y})','graphs equations','Средний')


def pythagoras(n, form):
    k=n+2
    if form == 0:
        return make(f'Катеты прямоугольного треугольника равны {3*k} и {4*k} см. Найдите гипотенузу в сантиметрах.',5*k,
                    f'По теореме Пифагора c² = {3*k}² + {4*k}² = {25*k*k}. Положительная длина c = {5*k} см.',
                    f'sqrt({3*k}**2+{4*k}**2)','geometry','Базовый')
    return make(f'Гипотенуза прямоугольного треугольника равна {13*k} см, один катет {5*k} см. Найдите площадь треугольника в см².',30*k*k,
                f'Второй катет равен √({13*k}² − {5*k}²) = {12*k} см. Площадь: {5*k} · {12*k}/2 = {30*k*k} см².',
                f'{5*k}*sqrt({13*k}**2-{5*k}**2)/2','geometry','Средний')


def trapezoid(n, form):
    a=n+5;b=n+11;h=n%8+3
    if form == 0:
        value=F((a+b)*h,2)
        return make(f'Основания трапеции равны {a} и {b} см, высота {h} см. Найдите площадь в см².',value,
                    f'Площадь равна произведению полусуммы оснований на высоту: ({a} + {b}) · {h}/2 = {fmt(value)} см².',
                    f'F(({a}+{b})*{h},2)','geometry','Базовый')
    area=F((a+b)*h,2)
    return make(f'Площадь трапеции {fmt(area)} см², основания {a} и {b} см. Найдите высоту в сантиметрах.',h,
                f'Средняя линия равна ({a} + {b})/2 = {(a+b)//2} см. Высота: {fmt(area)} : {(a+b)//2} = {h} см.',
                f'F(2*{area.numerator},{area.denominator}*({a}+{b}))','geometry equations','Средний')


def similarity(n, form):
    a=n+4;b=n%7+2
    if form == 0:
        small=2*a;big=3*a;area=4*b;answer=9*b
        return make(f'Соответствующие стороны двух подобных треугольников равны {small} и {big} см. Площадь меньшего равна {area} см². Найдите площадь большего в см².',answer,
                    f'Коэффициент подобия равен {big}/{small} = 3/2. Площади относятся как квадрат коэффициента: {area} · 9/4 = {answer} см².',
                    f'{area}*F({big},{small})**2','geometry','Средний')
    return make(f'Площади подобных многоугольников равны {4*a} и {9*a} см². Периметр меньшего {2*(n+7)} см. Найдите периметр большего в сантиметрах.',3*(n+7),
                f'Коэффициент подобия √({9*a}/{4*a}) = 3/2. Периметр увеличивается в 3/2 раза: {2*(n+7)} · 3/2 = {3*(n+7)} см.',
                f'{2*(n+7)}*sqrt(F({9*a},{4*a}))','geometry','Повышенный')


def inscribed_angle(n, form):
    a=20+n%140
    if form == 0:
        return make(f'Дуга окружности, на которую опирается вписанный угол, равна {a}°. Найдите этот угол в градусах.',F(a,2),
                    f'Вписанный угол равен половине дуги, на которую он опирается: {a}/2 = {fmt(F(a,2))}°.',
                    f'F({a},2)','geometry','Базовый')
    a=20+n%140
    return make(f'Один угол вписанного в окружность четырёхугольника равен {a}°. Найдите противоположный угол в градусах.',180-a,
                f'Сумма противоположных углов вписанного четырёхугольника равна 180°. Искомый угол: 180 − {a} = {180-a}°.',
                f'180-{a}','geometry','Средний')


def probability(n, form):
    red=n+3;blue=n%9+4;green=n%7+2;total=red+blue+green
    if form == 0:
        value=F(red,total)
        return make(f'В мешке {red} красных, {blue} синих и {green} зелёных шаров. Все шары равновероятно извлекаются. Найдите вероятность достать красный шар.',value,
                    f'Всего {total} шаров, из них {red} красных. Вероятность равна {red}/{total} = {fmt(value)}.',
                    f'F({red},{red}+{blue}+{green})','data','Базовый')
    value=F(red,total)*F(red-1,total-1)
    return make(f'В коробке {red} белых и {blue+green} чёрных шаров. Наугад последовательно достают два шара без возвращения. Найдите вероятность, что оба белые.',value,
                f'Вероятность первого белого шара {red}/{total}. После него остаётся {red-1} белых из {total-1} шаров. Произведение равно {fmt(value)}.',
                f'F(comb({red},2),comb({total},2))','data','Повышенный')


def variance_data(n, form):
    a=n+3;d=n%9+1;values=[a-d,a,a+d]
    if form == 0:
        value=F(2*d*d,3)
        return make(f'Найдите дисперсию набора {values[0]}, {values[1]}, {values[2]}. Дисперсия — среднее квадратов отклонений от среднего.',value,
                    f'Среднее равно {a}. Отклонения: −{d}, 0, {d}. Дисперсия ({d*d} + 0 + {d*d})/3 = {fmt(value)}.',
                    f'variance({values})','data calculations','Средний')
    k=n%5+2;value=F(2*d*d*k*k,3)
    return make(f'Даны числа {values[0]}, {values[1]}, {values[2]}. Каждое умножили на {k}. Найдите дисперсию нового набора; используется деление на число элементов.',value,
                f'Исходная дисперсия 2 · {d}²/3. При умножении всех значений на {k} дисперсия умножается на {k}². Получаем {fmt(value)}.',
                f'variance([x*{k} for x in {values}])','data calculations','Повышенный')


def conditional(n, form):
    a=n+3;b=n%7+2;c=n%5+1
    if form == 0:
        return make(f'В группе {a+b} участников: {a} изучают английский, {b} — немецкий. Среди изучающих английский {c} человек также знают французский. Случайно выбран участник, изучающий английский. Какова вероятность, что он знает французский?',F(c,a),
                    f'После условия выбор производится только среди {a} изучающих английский. Из них {c} знают французский. Вероятность {fmt(F(c,a))}.',
                    f'F({c},{a})','data','Средний')
    p=F(n%8+1,10);q=F(n%7+2,10);value=p*q
    return make(f'Независимые события A и B имеют вероятности {fmt(p)} и {fmt(q)}. Найдите вероятность их совместного наступления.',value,
                f'Для независимых событий P(A ∩ B) = P(A) · P(B) = ({fmt(p)}) · ({fmt(q)}) = {fmt(value)}.',
                f'F({p.numerator},{p.denominator})*F({q.numerator},{q.denominator})','data','Средний')


def arithmetic_sequence(n, form):
    a=n+3;d=n%7+2;k=n%10+6
    if form == 0:
        value=a+(k-1)*d
        return make(f'В арифметической прогрессии первый член {a}, разность {d}. Найдите член с номером {k}.',value,
                    f'От первого члена до {k}-го выполняется {k-1} шагов: {a} + {k-1} · {d} = {value}.',
                    f'{a}+({k}-1)*{d}','calculations','Базовый')
    value=F(k*(2*a+(k-1)*d),2)
    return make(f'В арифметической прогрессии a₁ = {a}, d = {d}. Найдите сумму первых {k} членов.',value,
                f'Последний член равен {a+(k-1)*d}. Сумма: ({a} + {a+(k-1)*d}) · {k}/2 = {fmt(value)}.',
                f'sum({a}+i*{d} for i in range({k}))','calculations','Средний')


def geometric_sequence(n, form):
    a=n+2;q=n%3+2;k=n%5+3
    if form == 0:
        value=a*q**(k-1)
        return make(f'В геометрической прогрессии первый член равен {a}, знаменатель {q}. Найдите член с номером {k}.',value,
                    f'Каждый переход умножает член на {q}. Поэтому b = {a} · {q}^{k-1} = {value}.',
                    f'{a}*{q}**({k}-1)','calculations','Базовый')
    value=a*(q**k-1)//(q-1)
    return make(f'Найдите сумму первых {k} членов геометрической прогрессии с b₁ = {a} и q = {q}.',value,
                f'Используем формулу S = b₁(q^k − 1)/(q − 1): {a} · ({q}^{k} − 1)/({q} − 1) = {value}.',
                f'sum({a}*{q}**i for i in range({k}))','calculations','Средний')


def parabola(n, form):
    h=n+2;k=n%11+3
    if form == 0:
        return make(f'Функция задана формулой y = (x − {h})² + {k}. Найдите её наименьшее значение.',k,
                    f'Квадрат неотрицателен и равен нулю при x = {h}. Поэтому минимум функции равен {k}.',
                    f'min((x-{h})**2+{k} for x in range({h-3},{h+4}))','graphs','Средний')
    return make(f'Парабола y = x² − {2*h}x + {h*h-k} пересекает прямую y = {4-k}. Найдите сумму абсцисс точек пересечения.',2*h,
                f'Выделим квадрат: (x − {h})² − {k} = {4-k}. Тогда (x − {h})² = 4, корни {h-2} и {h+2}, их сумма {2*h}.',
                f'sum(qroots(1,-{2*h},{h*h-k}-({4-k})))','graphs equations','Повышенный')


def biquadratic(n, form):
    a=n+2;b=n%5+1
    if form == 0:
        answer=sorted([-a,-b,b,a])
        return make(f'Решите уравнение x⁴ − {a*a+b*b}x² + {a*a*b*b} = 0. Укажите все действительные корни.',answer,
                    f'Положим t = x². Получаем (t − {a*a})(t − {b*b}) = 0. Значит x² = {a*a} или x² = {b*b}; корни: {", ".join(map(str,answer))}.',
                    f'biquad(1,-{a*a+b*b},{a*a*b*b})','equations','Повышенный')
    value=2*a*a+2*b*b
    return make(f'Найдите сумму квадратов всех действительных корней уравнения (x² − {a*a})(x² − {b*b}) = 0.',value,
                f'Корни равны ±{a} и ±{b}. Сумма квадратов: 2 · {a*a} + 2 · {b*b} = {value}.',
                f'sum(x*x for x in biquad(1,-{a*a+b*b},{a*a*b*b}))','equations calculations','Повышенный')


def quadratic_inequality(n, form):
    a=n+2;b=a+n%8+3
    if form == 0:
        return make(f'Сколько целых решений имеет неравенство (x − {a})(x − {b}) < 0?',b-a-1,
                    f'Произведение отрицательно между корнями: {a} < x < {b}. Целых чисел от {a+1} до {b-1} включительно {b-a-1}.',
                    f'len([x for x in range({a-2},{b+3}) if (x-{a})*(x-{b})<0])','equations','Средний')
    return make(f'Найдите наименьшее целое решение неравенства (x − {a})(x − {b}) ≤ 0.',a,
                f'Парабола направлена вверх. Неположительные значения получаются на отрезке [{a}; {b}]. Его левая граница — целое число {a}.',
                f'min(x for x in range({a-2},{b+3}) if (x-{a})*(x-{b})<=0)','equations','Средний')


def vectors2(n, form):
    a=n+3;b=n%7+2;c=n%5+1
    if form == 0:
        value=a*c-2*b
        return make(f'Даны векторы u = ({a}; −{b}) и v = ({c}; 2). Найдите их скалярное произведение.',value,
                    f'Умножим соответствующие координаты и сложим: {a} · {c} + (−{b}) · 2 = {value}.',
                    f'sum(x*y for x,y in zip([{a},-{b}],[{c},2]))','geometry calculations','Базовый')
    return make(f'Даны точки A({a}; {b}) и B({a+3*c}; {b+4*c}). Найдите расстояние AB.',5*c,
                f'Разности координат равны {3*c} и {4*c}. Расстояние √({3*c}² + {4*c}²) = {5*c}.',
                f'sqrt(({a+3*c}-{a})**2+({b+4*c}-{b})**2)','geometry','Средний')


def sector(n, form):
    r=n+3;angle=30*(n%5+1)
    if form == 0:
        value=F(r*r*angle,360)
        return make(f'Радиус круга {r} см, центральный угол сектора {angle}°. Площадь сектора равна kπ см². Найдите k.',value,
                    f'Сектор занимает {angle}/360 круга. Поэтому k = {r}² · {angle}/360 = {fmt(value)}.',
                    f'F({r}**2*{angle},360)','geometry','Средний')
    value=F(2*r*angle,360)
    return make(f'На окружности радиуса {r} см выделена дуга с центральным углом {angle}°. Её длина равна kπ см. Найдите k.',value,
                f'Длина всей окружности 2π · {r}. Доля дуги {angle}/360, поэтому k = 2 · {r} · {angle}/360 = {fmt(value)}.',
                f'F(2*{r}*{angle},360)','geometry','Средний')


def cosine_rule(n, form):
    a=n+3;b=n%9+2
    if form == 0:
        value=a*a+b*b-a*b
        return make(f'Стороны треугольника {a} и {b} см образуют угол 60°. Найдите квадрат длины третьей стороны в см².',value,
                    f'По теореме косинусов c² = {a}² + {b}² − 2 · {a} · {b} · cos 60°. Так как cos 60° = 1/2, получаем {value}.',
                    f'{a}**2+{b}**2-2*{a}*{b}*F(1,2)','geometry','Средний')
    value=a*a+b*b+a*b
    return make(f'Две стороны треугольника равны {a} и {b} см, угол между ними 120°. Найдите квадрат третьей стороны в см².',value,
                f'В теореме косинусов cos 120° = −1/2, поэтому c² = {a}² + {b}² + {a} · {b} = {value}.',
                f'{a}**2+{b}**2-2*{a}*{b}*F(-1,2)','geometry','Средний')


def combinations(n, form):
    count=n+5
    if form == 0:
        return make(f'Из {count} участников выбирают команду из трёх человек. Порядок выбора не учитывается. Сколько различных команд возможно?',comb(count,3),
                    f'Упорядоченных троек {count} · {count-1} · {count-2}. Каждая команда посчитана 3! = 6 раз. Всего {comb(count,3)} команд.',
                    f'len(list(combinations(range({count}),3)))','data','Средний')
    return make(f'Из {count} кандидатов выбирают председателя и секретаря. Один человек не может занимать обе должности. Сколько способов выбора?',count*(count-1),
                f'Председателя можно выбрать {count} способами, секретаря — {count-1} способами. По правилу произведения получаем {count*(count-1)}.',
                f'len(list(permutations(range({count}),2)))','data','Средний')


def binomial(n, form):
    trials=4+n//8;p=F(n%8+1,10)
    if form == 0:
        value=float(F(floor((1-p)**trials*1000+F(1,2)),1000))
        return make(f'Вероятность успеха в каждом из {trials} независимых испытаний равна {fmt(p)}. Найдите вероятность ни одного успеха. Ответ округлите до тысячных.',value,
                    f'Вероятность неудачи в одном испытании {fmt(1-p)}. Для всех испытаний перемножаем вероятности: ({fmt(1-p)})^{trials}. После округления получаем {value:.3f}.',
                    f'F(floor((1-F({p.numerator},{p.denominator}))**{trials}*1000+F(1,2)),1000)','data','Средний',3)
    value=float(F(floor(trials*p*(1-p)**(trials-1)*1000+F(1,2)),1000))
    return make(f'Проводят {trials} независимых испытаний с вероятностью успеха {fmt(p)} в каждом. Найдите вероятность ровно одного успеха. Округлите до тысячных.',value,
                f'Единственный успех может стоять на любом из {trials} мест. Вероятность равна {trials} · ({fmt(p)}) · ({fmt(1-p)})^{trials-1}. После округления {value:.3f}.',
                f'F(floor(comb({trials},1)*F({p.numerator},{p.denominator})*(1-F({p.numerator},{p.denominator}))**({trials}-1)*1000+F(1,2)),1000)','data','Повышенный',3)


def random_variable(n, form):
    a=n+2;b=a+n%7+3;p=F(n%8+1,10)
    if form == 0:
        value=a*p+b*(1-p)
        return make(f'Случайная величина X принимает значение {a} с вероятностью {fmt(p)} и значение {b} с вероятностью {fmt(1-p)}. Найдите математическое ожидание X.',value,
                    f'Ожидание — взвешенная сумма: {a} · ({fmt(p)}) + {b} · ({fmt(1-p)}) = {fmt(value)}.',
                    f'expect([{a},{b}],[F({p.numerator},{p.denominator}),F({(1-p).numerator},{(1-p).denominator})])','data','Средний')
    value=p*(1-p)*(b-a)**2
    return make(f'X принимает только значения {a} и {b} с вероятностями {fmt(p)} и {fmt(1-p)} соответственно. Найдите дисперсию X.',value,
                f'Для двух значений дисперсия равна p(1 − p)(b − a)². Подставим данные: ({fmt(p)}) · ({fmt(1-p)}) · {b-a}² = {fmt(value)}.',
                f'variance_rv([{a},{b}],[F({p.numerator},{p.denominator}),F({(1-p).numerator},{(1-p).denominator})])','data','Повышенный')


def nth_root(n, form):
    a=n+3;k=n%3+3
    if form == 0:
        return make(f'Найдите положительный корень степени {k} из числа {a**k}.',a,
                    f'{a}^{k} = {a**k}. Положительное число, возведение которого в степень {k} даёт {a**k}, равно {a}.',
                    f'({a**k})**F(1,{k})','calculations','Базовый')
    b=n%4+2
    return make(f'Вычислите ({a} · {b})⁻¹ + 1/{a}. Ответ запишите дробью.',F(b+1,a*b),
                f'Отрицательная степень даёт 1/{a*b}. Приводим к общему знаменателю: 1/{a*b} + {b}/{a*b} = {fmt(F(b+1,a*b))}.',
                f'F(1,{a}*{b})+F(1,{a})','calculations','Средний')


def irrational_equation(n, form):
    r=n+3;a=n%7+2
    if form == 0:
        x=r*r-a
        return make(f'Решите уравнение √(x + {a}) = {r}.',x,
                    f'Правая часть неотрицательна. Возведём в квадрат: x + {a} = {r*r}, x = {x}. Проверка: √{r*r} = {r}.',
                    f'{r}**2-{a}','equations','Средний')
    x=r*r+a
    return make(f'Решите уравнение √(x − {a}) + {a} = {r+a}.',x,
                f'Переносим {a}: √(x − {a}) = {r}. Получаем x − {a} = {r*r}, x = {x}; подкоренное выражение положительно.',
                f'({r+a}-{a})**2+{a}','equations','Средний')


def trig_value(n, form):
    a=n+3;b=n%9+2
    if form == 0:
        value=F(a+b,2)
        return make(f'Вычислите {a} · sin(π/6) + {b} · cos(π/3).',value,
                    f'sin(π/6) = cos(π/3) = 1/2. Поэтому значение равно ({a} + {b})/2 = {fmt(value)}.',
                    f'{a}*sin(pi/6)+{b}*cos(pi/3)','calculations','Базовый')
    value=F(3*a+b,4)
    return make(f'Вычислите {a} · sin²(π/3) + {b} · cos²(π/3).',value,
                f'sin²(π/3) = 3/4, cos²(π/3) = 1/4. Получаем (3 · {a} + {b})/4 = {fmt(value)}.',
                f'{a}*sin(pi/3)**2+{b}*cos(pi/3)**2','calculations','Средний')


def trig_equation(n, form):
    k=n+2
    if form == 0:
        return make(f'Сколько корней уравнения sin x = 0 принадлежит отрезку [0; {k}π]?',k+1,
                    f'Корни имеют вид x = mπ, где m — целое. На отрезке подходят m = 0, 1, …, {k}; всего {k+1} значений.',
                    f'len(list(range(0,{k}+1)))','equations','Средний')
    return make(f'Найдите число корней уравнения cos x = 0 на интервале (0; {k}π).',k,
                f'Корни x = π/2 + mπ. На данном интервале m принимает значения от 0 до {k-1}; всего {k} корней.',
                f'len([m for m in range(-1,{k}+1) if 0<F(1,2)+m<{k}])','equations','Средний')


def logarithms(n, form):
    base=n%5+2;power=n%5+2;shift=n+4
    if form == 0:
        value=base**power+shift
        return make(f'Решите уравнение log_{base}(x − {shift}) = {power}.',value,
                    f'ОДЗ: x > {shift}. По определению логарифма x − {shift} = {base}^{power} = {base**power}. Значит x = {value}; ОДЗ выполнено.',
                    f'{base}**{power}+{shift}','equations','Средний')
    # The varying factor prevents repeated conditions when the base cycles.
    a=shift;value=power
    return make(f'Вычислите log_{base}({a*base**power}) − log_{base}({a}).',value,
                f'Разность равна логарифму частного: log_{base}({a*base**power}/{a}) = log_{base}({base**power}) = {power}.',
                f'log(F({a*base**power},{a}),{base})','calculations','Средний')


def exponential(n, form):
    base=n%4+2;power=n%5+2;shift=n+3
    if form == 0:
        value=power+shift
        return make(f'Решите уравнение {base}^(x − {shift}) = {base**power}.',value,
                    f'Правая часть равна {base}^{power}. Так как основание больше 1, показатели равны: x − {shift} = {power}. Получаем x = {value}.',
                    f'log({base**power},{base})+{shift}','equations','Средний')
    return make(f'Решите уравнение {base}^(x + {shift}) = 1/{base**power}.',-power-shift,
                f'Правая часть равна {base}^(-{power}). Поэтому x + {shift} = −{power}, откуда x = {-power-shift}.',
                f'log(F(1,{base**power}),{base})-{shift}','equations','Средний')


def polynomial_remainder(n, form):
    a=n+2;b=n%7+1;c=n%5+3
    if form == 0:
        value=c**3+a*c+b
        return make(f'Найдите остаток от деления многочлена x³ + {a}x + {b} на x − {c}.',value,
                    f'По теореме Безу остаток равен значению многочлена при x = {c}: {c}³ + {a} · {c} + {b} = {value}.',
                    f'{c}**3+{a}*{c}+{b}','calculations','Средний')
    value=6*a*a
    return make(f'В разложении (x + {a})⁴ найдите коэффициент при x².',value,
                f'Чтобы получить x², выбираем x из двух скобок, число {a} — из двух других. Способов C(4, 2) = 6; коэффициент равен 6 · {a}² = {value}.',
                f'comb(4,2)*{a}**2','calculations data','Повышенный')


def matrix_determinant(n, form):
    a=n+2;b=n%7+1;c=n%5+2;d=n%9+3
    if form == 0:
        value=a*d-b*c
        return make(f'Найдите определитель матрицы с первой строкой ({a}, {b}) и второй строкой ({c}, {d}).',value,
                    f'Для матрицы 2 × 2 определитель равен ad − bc: {a} · {d} − {b} · {c} = {value}.',
                    f'{a}*{d}-{b}*{c}','calculations','Средний')
    value=b*c
    return make(f'При каком x определитель матрицы с первой строкой (x, {b}) и второй строкой ({c}, 1) равен нулю?',value,
                f'Определитель равен x · 1 − {b} · {c}. Приравниваем его нулю и получаем x = {value}.',
                f'F({b}*{c},1)','equations calculations','Средний')


def composition(n, form):
    a=n+3;b=n%7+2;x=n%5+1
    if form == 0:
        value=(a*x+b)**2
        return make(f'Даны f(x) = x² и g(x) = {a}x + {b}. Найдите f(g({x})).',value,
                    f'Сначала g({x}) = {a*x+b}. Затем f({a*x+b}) = {a*x+b}² = {value}. Порядок подстановок существенен.',
                    f'({a}*{x}+{b})**2','graphs calculations','Средний')
    value=a*x*x+b
    return make(f'Даны f(x) = x² и g(x) = {a}x + {b}. Найдите g(f({x})).',value,
                f'Сначала f({x}) = {x*x}. Далее g({x*x}) = {a} · {x*x} + {b} = {value}.',
                f'{a}*({x}**2)+{b}','graphs calculations','Средний')


def derivative(n, form):
    a=n+2;b=n%7+1;x=n%5+2
    if form == 0:
        value=2*a*x+b
        return make(f'Найдите значение производной функции f(x) = {a}x² + {b}x − {n} в точке x = {x}.',value,
                    f'Производная равна f′(x) = {2*a}x + {b}. При x = {x} получаем {2*a} · {x} + {b} = {value}.',
                    f'derivative_poly([{a},{b},-{n}],{x})','graphs calculations','Средний')
    intercept=-a*x*x+n
    return make(f'К графику y = {a}x² + {n} проведена касательная в точке с абсциссой {x}. Найдите ординату точки пересечения касательной с осью y.',intercept,
                f'Угловой коэффициент равен 2 · {a} · {x} = {2*a*x}. В уравнении касательной y = {2*a*x}(x − {x}) + {a*x*x+n} свободный член равен {intercept}.',
                f'({a}*{x}**2+{n})-derivative_poly([{a},0,{n}],{x})*{x}','graphs','Повышенный')


def spatial_distance(n, form):
    k=n+2
    if form == 0:
        return make(f'Из точки A к плоскости проведён перпендикуляр AH = {3*k} см и наклонная AB = {5*k} см. Найдите длину проекции HB в сантиметрах.',4*k,
                    f'Треугольник AHB прямоугольный при H. По теореме Пифагора HB = √({5*k}² − {3*k}²) = {4*k} см.',
                    f'sqrt({5*k}**2-{3*k}**2)','geometry','Средний')
    return make(f'Рёбра прямоугольного параллелепипеда, выходящие из одной вершины, равны {2*k}, {3*k} и {6*k} см. Найдите его пространственную диагональ в сантиметрах.',7*k,
                f'Квадрат диагонали равен сумме квадратов трёх рёбер: {2*k}² + {3*k}² + {6*k}² = {49*k*k}. Диагональ равна {7*k} см.',
                f'sqrt({2*k}**2+{3*k}**2+{6*k}**2)','geometry','Средний')


def solid_volume(n, form):
    area=3*(n+4);height=n%9+3
    if form == 0:
        return make(f'Площадь основания прямой призмы {area} см², высота {height} см. Найдите объём в см³.',area*height,
                    f'Объём призмы равен произведению площади основания на высоту: {area} · {height} = {area*height} см³.',
                    f'{area}*{height}','geometry','Базовый')
    return make(f'Площадь основания пирамиды {area} см², высота {height} см. Найдите её объём в см³.',area*height//3,
                f'Объём пирамиды равен трети произведения площади основания на высоту: {area} · {height}/3 = {area*height//3} см³.',
                f'F({area}*{height},3)','geometry','Базовый')


def vectors3(n, form):
    a=n+2;b=n%7+1;c=n%5+2
    if form == 0:
        value=2*a-b+3*c
        return make(f'Даны векторы u = ({a}; {b}; {c}) и v = (2; −1; 3). Найдите u · v.',value,
                    f'Скалярное произведение равно сумме произведений соответствующих координат: 2 · {a} − {b} + 3 · {c} = {value}.',
                    f'sum(x*y for x,y in zip([{a},{b},{c}],[2,-1,3]))','geometry calculations','Базовый')
    value=b-2*a
    return make(f'Векторы ({a}; {b}; k) и (2; −1; 1) перпендикулярны. Найдите k.',value,
                f'У перпендикулярных векторов скалярное произведение равно нулю: 2 · {a} − {b} + k = 0. Значит k = {value}.',
                f'{b}-2*{a}','geometry equations','Средний')


def total_probability(n, form):
    first=n+4;second=n%8+3;red1=n%3+1;red2=n%2+1
    value=(F(red1,first)+F(red2,second))/2
    if form == 0:
        return make(f'В первой коробке {first} шаров, из них {red1} красных; во второй {second} шара, из них {red2} красных. Коробку выбирают равновероятно, затем шар из неё наугад. Найдите вероятность красного шара.',value,
                    f'Вероятность каждого выбора коробки равна 1/2. По формуле полной вероятности P = (1/2) · ({red1}/{first}) + (1/2) · ({red2}/{second}) = {fmt(value)}.',
                    f'F(1,2)*F({red1},{first})+F(1,2)*F({red2},{second})','data','Повышенный')
    posterior=F(red1,first)/(F(red1,first)+F(red2,second))
    return make(f'Равновероятно выбирают одну из двух коробок. В первой {red1} красных из {first} шаров, во второй {red2} красных из {second}. Из выбранной коробки наугад достали красный шар. Какова вероятность, что выбрана первая коробка?',posterior,
                f'Вероятность красного шара равна {fmt(value)}. Вероятность выбрать первую коробку и красный шар равна {fmt(F(red1,2*first))}. По формуле Байеса их отношение равно {fmt(posterior)}.',
                f'(F(1,2)*F({red1},{first}))/(F(1,2)*F({red1},{first})+F(1,2)*F({red2},{second}))','data','Повышенный')


def logarithmic_inequality(n, form):
    base=n%4+2;k=n%4+2;a=n+3;upper=a+base**k
    if form == 0:
        value=base**k
        return make(f'Сколько целых решений имеет неравенство log_{base}(x − {a}) ≤ {k}?',value,
                    f'ОДЗ: x > {a}. Основание больше 1, поэтому x − {a} ≤ {base}^{k}. Целые x лежат от {a+1} до {upper} включительно; их {value}.',
                    f'len([x for x in range({a-1},{upper+2}) if 0<x-{a}<={base}**{k}])','equations','Повышенный')
    value=upper
    return make(f'Найдите наименьшее целое решение неравенства log_{base}(x − {a}) ≥ {k}.',value,
                f'При основании {base} > 1 знак сохраняется: x − {a} ≥ {base**k}. Получаем x ≥ {upper}; ОДЗ выполнено. Наименьшее целое {value}.',
                f'{a}+{base}**{k}','equations','Средний')


def optimization(n, form):
    h=n+4;k=n%9+3
    if form == 0:
        value=h*h
        return make(f'Прямоугольник имеет периметр {4*h} см. Какова наибольшая возможная площадь в см²?',value,
                    f'Если одна сторона x, другая {2*h} − x. Площадь x({2*h} − x) = {h*h} − (x − {h})², её максимум {value} достигается у квадрата.',
                    f'max(x*({2*h}-x) for x in range(1,{2*h}))','geometry graphs modelling','Повышенный')
    value=k
    return make(f'Найдите наименьшее значение функции f(x) = {k}(x − {h})² + {k} на всей числовой прямой.',value,
                f'Коэффициент {k} положителен, квадрат неотрицателен. При x = {h} квадрат равен нулю и f(x) = {value}; меньших значений нет.',
                f'min({k}*(x-{h})**2+{k} for x in range({h-2},{h+3}))','graphs','Средний')


def integral(n, form):
    a=n+2;b=n%7+1;t=n%5+2
    if form == 0:
        value=a*t*t+b*t
        return make(f'Вычислите определённый интеграл функции {2*a}x + {b} по отрезку от 0 до {t}.',value,
                    f'Первообразная: {a}x² + {b}x. По формуле Ньютона — Лейбница получаем {a} · {t}² + {b} · {t} − 0 = {value}.',
                    f'integral_poly([{2*a},{b}],0,{t})','graphs calculations','Средний')
    c=n+5;value=a*t**3+c
    return make(f'F′(x) = {3*a}x², F(0) = {c}. Найдите F({t}).',value,
                f'Первообразные имеют вид F(x) = {a}x³ + C. Из F(0) = {c} следует C = {c}. Поэтому F({t}) = {a} · {t}³ + {c} = {value}.',
                f'{c}+integral_poly([{3*a},0,0],0,{t})','graphs calculations','Средний')


def cylinder(n, form):
    r=n+2;h=n%9+3
    if form == 0:
        return make(f'Цилиндр имеет радиус основания {r} см и высоту {h} см. Его объём равен kπ см³. Найдите k.',r*r*h,
                    f'Объём цилиндра V = πr²h. Коэффициент при π равен {r}² · {h} = {r*r*h}.',
                    f'{r}**2*{h}','geometry','Базовый')
    value=2*r*(r+h)
    return make(f'Радиус цилиндра {r} см, высота {h} см. Полная поверхность равна kπ см². Найдите k.',value,
                f'Два основания дают 2πr², боковая поверхность 2πrh. Значит k = 2 · {r} · ({r} + {h}) = {value}.',
                f'2*{r}**2+2*{r}*{h}','geometry','Средний')


def sphere(n, form):
    r=n+2
    if form == 0:
        return make(f'Радиус сферы {r} см. Её площадь равна kπ см². Найдите k.',4*r*r,
                    f'Площадь сферы S = 4πr², поэтому k = 4 · {r}² = {4*r*r}.',
                    f'4*{r}**2','geometry','Базовый')
    value=F(4*r**3,3)
    return make(f'Шар имеет радиус {r} см. Его объём равен kπ см³. Найдите k.',value,
                f'Объём шара V = 4πr³/3, поэтому k = 4 · {r}³/3 = {fmt(value)}.',
                f'F(4*{r}**3,3)','geometry','Средний')


def uniform(n, form):
    a=n+2;length=2*(n%8+3);b=a+length
    if form == 0:
        value=F(3,length)
        return make(f'Случайная величина X равномерно распределена на отрезке [{a}; {b}]. Найдите вероятность попадания X в отрезок [{a+1}; {a+4}].',value,
                    f'Для равномерного распределения вероятность равна отношению длин: ({a+4} − {a+1})/({b} − {a}) = {fmt(value)}.',
                    f'F({a+4}-{a+1},{b}-{a})','data','Средний')
    value=F(length*length,12)
    return make(f'X равномерно распределена на [{a}; {b}]. Найдите дисперсию X.',value,
                f'Для равномерного распределения на [a; b] дисперсия (b − a)²/12. Подставляя длину {length}, получаем {fmt(value)}.',
                f'F(({b}-{a})**2,12)','data','Повышенный')


def complex_numbers(n, form):
    a=n+2;b=n%7+1;c=n%5+3
    if form == 0:
        value=a*c+2*b
        return make(f'Вычислите действительную часть произведения ({a} + {b}i)({c} − 2i), где i² = −1.',value,
                    f'Действительные слагаемые: {a} · {c} и −2 · {b} · i² = {2*b}. Их сумма {value}.',
                    f'((complex({a},{b}))*complex({c},-2)).real','calculations','Средний')
    value=a*a+b*b
    return make(f'Комплексное число z = {a} − {b}i. Найдите |z|².',value,
                f'Квадрат модуля равен сумме квадратов действительной и мнимой частей: {a}² + (−{b})² = {value}.',
                f'abs(complex({a},-{b}))**2','calculations','Базовый')


def number_theory(n, form):
    modulus=n%13+3;a=n+5;power=n%5+3
    if form == 0:
        return make(f'Найдите остаток от деления {a}^{power} на {modulus}.',pow(a,power,modulus),
                    f'Заменим основание его остатком {a%modulus}. Возводим в степень {power}, каждый раз беря остаток по модулю {modulus}; получаем {pow(a,power,modulus)}.',
                    f'({a}**{power})%{modulus}','calculations reasoning','Средний')
    limit=n+30;k=n%9+3
    return make(f'Сколько натуральных чисел, не превосходящих {limit}, делятся на {k}?',limit//k,
                f'Это числа {k}, {2*k}, {3*k}, …, {k*(limit//k)}. Их число равно целой части {limit}/{k}, то есть {limit//k}.',
                f'len([x for x in range(1,{limit}+1) if x%{k}==0])','calculations reasoning','Средний')


def parameter(n, form):
    a=n+3;b=n%9+2
    if form == 0:
        value=a*a
        return make(f'При каком значении параметра p квадратное уравнение x² − {2*a}x + p = 0 имеет ровно один действительный корень?',value,
                    f'Единственный корень возникает при нулевом дискриминанте: {2*a}² − 4p = 0. Поэтому p = {a*a}.',
                    f'F({2*a}**2,4)','equations','Повышенный')
    value=F(b,a)
    return make(f'Уравнение (p · {a} − {b})x = {n+1} не имеет решений. Найдите p.',value,
                f'Правая часть {n+1} не равна нулю. Отсутствие решений возможно только при нулевом коэффициенте x: {a}p − {b} = 0, значит p = {fmt(value)}.',
                f'F({b},{a})','equations reasoning','Повышенный')


def advanced_integral(n, form):
    a=n+2;t=n%5+2
    if form == 0:
        value=F(2*a*t**3,3)
        return make(f'Вычислите интеграл функции {a}x² + {n+3}x³ по отрезку [−{t}; {t}].',value,
                    f'Интеграл нечётного слагаемого x³ на симметричном отрезке равен нулю. Чётная часть даёт 2 · {a} · {t}³/3 = {fmt(value)}.',
                    f'integral_poly([{n+3},{a},0,0],-{t},{t})','graphs calculations','Повышенный')
    value=F(a*t**3,6)
    return make(f'Найдите площадь фигуры между графиком y = {a}x({t} − x) и осью x на отрезке [0; {t}].',value,
                f'На отрезке функция неотрицательна. Площадь равна интегралу {a}({t}x − x²): {a} · ({t} · {t}²/2 − {t}³/3) = {fmt(value)}.',
                f'integral_poly([-{a},{a*t},0],0,{t})','graphs geometry','Повышенный')


def trig_inequality(n, form):
    k=n+2
    if form == 0:
        return make(f'Общая длина участков отрезка [0; {2*k}π], где sin x > 0, равна Lπ. Найдите L.',k,
                    f'На каждом полном периоде длиной 2π синус положителен на интервале длиной π. На данном отрезке {k} полных периодов, поэтому L = {k}.',
                    f'F({2*k},2)','graphs equations','Повышенный')
    return make(f'Общая длина участков отрезка [0; {2*k}π], где cos x ≤ 0, равна Lπ. Найдите L.',k,
                f'В каждом периоде 2π косинус неположителен на отрезке длиной π. Имеется {k} полных периодов, сумма длин {k}π, L = {k}.',
                f'F({2*k},2)','graphs equations','Повышенный')


def frustum(n, form):
    r=n+2;R=r+n%5+1;h=3*(n%7+1)
    if form == 0:
        value=h*(R*R+R*r+r*r)//3
        return make(f'Радиусы оснований усечённого конуса {r} и {R} см, высота {h} см. Объём равен kπ см³. Найдите k.',value,
                    f'V = πh(R² + Rr + r²)/3. Коэффициент k = {h} · ({R}² + {R} · {r} + {r}²)/3 = {value}.',
                    f'F({h}*({R}**2+{R}*{r}+{r}**2),3)','geometry','Повышенный')
    l=R+r+n+1;value=(R+r)*l
    return make(f'Радиусы оснований усечённого конуса {r} и {R} см, образующая {l} см. Площадь боковой поверхности равна kπ см². Найдите k.',value,
                f'Боковая поверхность S = π(R + r)l. Поэтому k = ({R} + {r}) · {l} = {value}.',
                f'({R}+{r})*{l}','geometry','Средний')


def sphere_section(n, form):
    k=n+2
    if form == 0:
        value=16*k*k
        return make(f'Шар радиуса {5*k} см пересечён плоскостью на расстоянии {3*k} см от центра. Площадь сечения равна kπ см². Найдите коэффициент k.',value,
                    f'Радиус сечения r удовлетворяет r² = {5*k}² − {3*k}² = {value}. Площадь круга πr², поэтому коэффициент равен {value}.',
                    f'{5*k}**2-{3*k}**2','geometry','Средний')
    r=n+4;h=n%5+1;value=F(h*h*(3*r-h),3)
    return make(f'Шаровой сегмент имеет высоту {h} см; радиус шара {r} см. Объём сегмента равен kπ см³. Найдите k. Используйте формулу V = πh²(R − h/3).',value,
                f'Подставим R = {r}, h = {h}: k = {h}² · ({r} − {h}/3) = {fmt(value)}.',
                f'{h}**2*(F({r})-F({h},3))','geometry calculations','Повышенный')


def volume_scale(n, form):
    a=n+3;b=n%4+2;volume=a**3
    if form == 0:
        value=volume*b**3
        return make(f'Объём одного многогранника {volume} см³. Все линейные размеры подобного ему многогранника в {b} раза больше. Найдите объём второго в см³.',value,
                    f'Объёмы подобных тел относятся как куб коэффициента подобия. Второй объём: {volume} · {b}³ = {value} см³.',
                    f'{volume}*{b}**3','geometry','Средний')
    value=b
    return make(f'Объёмы двух подобных тел равны {volume} и {volume*b**3} см³. Во сколько раз линейные размеры второго больше размеров первого?',value,
                f'Отношение объёмов {volume*b**3}/{volume} = {b**3}. Отношение линейных размеров равно кубическому корню из {b**3}, то есть {b}.',
                f'(F({volume*b**3},{volume}))**F(1,3)','geometry','Средний')


def chebyshev(n, form):
    variance=n+2;k=n%5+2;threshold=k*(n+2)
    if form == 0:
        value=F(variance,threshold*threshold)
        return make(f'Дисперсия X равна {variance}. По неравенству Чебышёва найдите верхнюю границу вероятности |X − E(X)| ≥ {threshold}.',value,
                    f'Неравенство Чебышёва даёт P ≤ D(X)/ε². Подставляем ε = {threshold}: верхняя граница {variance}/{threshold}² = {fmt(value)}.',
                    f'F({variance},{threshold}**2)','data','Повышенный')
    value=1-F(variance,threshold*threshold)
    return make(f'Дисперсия случайной величины равна {variance}. По неравенству Чебышёва найдите нижнюю границу вероятности |X − E(X)| < {threshold}.',value,
                f'Вероятность дополнительного события не больше {fmt(F(variance,threshold*threshold))}. Искомая нижняя граница равна 1 − {fmt(F(variance,threshold*threshold))} = {fmt(value)}.',
                f'1-F({variance},{threshold}**2)','data','Повышенный')


def poisson(n, form):
    rate=F(n+3,4)
    if form == 0:
        value=round(exp(-float(rate)),3)
        return make(f'X имеет распределение Пуассона с параметром λ = {fmt(rate)}. Найдите P(X = 0), округлив до тысячных.',value,
                    f'По формуле Пуассона P(X = k) = e^(−λ)λ^k/k!. При k = 0 остаётся e^(−{fmt(rate)}), после округления {value:.3f}.',
                    f'round(exp(-F({rate.numerator},{rate.denominator})),3)','data','Повышенный',3)
    time=n%5+2;value=rate*time
    return make(f'Поток заявок пуассоновский, в среднем {fmt(rate)} заявки в час. Найдите дисперсию числа заявок за {time} часа.',value,
                f'Параметр за {time} часа равен {fmt(rate)} · {time} = {fmt(value)}. Дисперсия распределения Пуассона совпадает с его параметром.',
                f'F({rate.numerator},{rate.denominator})*{time}','data','Средний')


def regression(n, form):
    a=n+2;b=n%7+1;xs=[1,2,3,4];ys=[a*x+b for x in xs]
    if form == 0:
        return make(f'Наблюдения (x; y): (1; {ys[0]}), (2; {ys[1]}), (3; {ys[2]}), (4; {ys[3]}). Найдите угловой коэффициент линейной регрессии y на x.',a,
                    f'При увеличении x на 1 значение y каждый раз увеличивается на {a}. Все точки лежат на прямой y = {a}x + {b}; коэффициент регрессии равен {a}.',
                    f'regression_slope({xs},{ys})','data graphs','Средний')
    covariance=F(5*a,4)
    return make(f'Для пар (1; {ys[0]}), (2; {ys[1]}), (3; {ys[2]}), (4; {ys[3]}) найдите ковариацию, используя деление на число наблюдений 4.',covariance,
                f'Здесь y = {a}x + {b}, поэтому cov(x, y) = {a} · D(x). Для 1, 2, 3, 4 дисперсия 5/4; ковариация равна {fmt(covariance)}.',
                f'sum((x-mean({xs}))*(y-mean({ys})) for x,y in zip({xs},{ys}))/4','data calculations','Повышенный')
