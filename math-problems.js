/* Curriculum-aligned numeric questions. No DOM, storage, or network side effects. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MathProblems = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const templates = {};
    function add(level, id, type, hint, build) {
        (templates[level] || (templates[level] = [])).push(int => {
            const [text, answer] = build(int);
            return { text, answer, type, hint, templateId: id };
        });
    }
    add(1, 'integer-add', '정수와 유리수', '같은 부호와 다른 부호의 덧셈 규칙을 적용하세요.', r => { const a=r(-12,15), b=r(-12,15); return [`(${a}) + (${b})의 값은?`, a+b]; });
    add(1, 'integer-subtract', '정수와 유리수', '빼는 수의 부호를 바꾸어 더하세요.', r => { const a=r(-12,15), b=r(-12,15); return [`(${a}) − (${b})의 값은?`, a-b]; });
    add(1, 'integer-multiply', '정수와 유리수', '곱의 부호를 먼저 정하세요.', r => { const a=r(-9,9), b=r(-9,9); return [`(${a}) × (${b})의 값은?`, a*b]; });
    add(1, 'integer-divide', '정수와 유리수', '나눗셈에서도 두 수의 부호를 확인하세요.', r => { const a=r(-9,9), b=r(2,9); return [`(${a*b}) ÷ (${b})의 값은?`, a]; });
    add(2, 'expression-linear', '문자와 식', '대입한 뒤 곱셈을 먼저 계산하세요.', r => { const x=r(-5,8), a=r(2,7), b=r(-9,9); return [`x=(${x})일 때 ${a}x + (${b})의 값은?`, a*x+b]; });
    add(2, 'expression-square', '문자와 식', '음수를 제곱할 때 괄호를 잊지 마세요.', r => { const x=r(-5,5), a=r(1,4), b=r(-6,6); return [`x=(${x})일 때 ${a}x² + (${b})의 값은?`, a*x*x+b]; });
    add(2, 'expression-distribute', '문자와 식', '괄호 안을 계산한 뒤 곱하세요.', r => { const x=r(-5,8), a=r(2,6), b=r(-7,7); return [`x=(${x})일 때 ${a}(x + (${b}))의 값은?`, a*(x+b)]; });
    add(2, 'expression-two-variables', '문자와 식', '두 문자에 각각 주어진 값을 대입하세요.', r => { const x=r(-5,5), y=r(-5,5), a=r(1,5), b=r(1,5); return [`x=(${x}), y=(${y})일 때 ${a}x + ${b}y의 값은?`, a*x+b*y]; });
    add(3, 'equation-linear', '일차방정식', '상수항을 이항한 뒤 계수로 나누세요.', r => { const x=r(-8,12), a=r(2,9), b=r(-12,12); return [`${a}x + (${b}) = ${a*x+b}일 때 x는?`, x]; });
    add(3, 'equation-both-sides', '일차방정식', '문자항끼리, 상수항끼리 모으세요.', r => { const x=r(-8,12), c=r(1,4), a=c+r(1,5), b=r(-8,8); return [`${a}x + (${b}) = ${c}x + (${(a-c)*x+b})일 때 x는?`, x]; });
    add(3, 'equation-brackets', '일차방정식', '양변을 괄호 앞의 수로 나누세요.', r => { const x=r(-8,12), a=r(2,8), b=r(-6,6); return [`${a}(x + (${b})) = ${a*(x+b)}일 때 x는?`, x]; });
    add(3, 'equation-fraction', '일차방정식', '상수를 이항하고 분모를 곱하세요.', r => { const a=r(2,6), b=r(-6,6), c=r(-5,5); return [`x/${a} + (${b}) = ${c}일 때 x는?`, a*(c-b)]; });
    add(4, 'rational-add', '유리수와 순환소수', '공통분모로 통분하여 더하세요.', r => { const a=r(1,8), b=r(2,9), c=r(1,8), d=r(2,9); return [`${a}/${b} + ${c}/${d}의 값은?`, a/b+c/d]; });
    add(4, 'rational-multiply', '유리수와 순환소수', '분자끼리, 분모끼리 곱하세요.', r => { const a=r(1,8), b=r(2,9), c=r(1,8), d=r(2,9); return [`${a}/${b} × ${c}/${d}의 값은?`, a*c/(b*d)]; });
    add(4, 'decimal-fraction', '유리수와 순환소수', '백분율을 소수로 바꾸듯 분모로 나누세요.', r => { const a=r(1,99); return [`${a}/100을 소수로 나타낸 값은?`, a/100]; });
    add(4, 'repeating-decimal', '유리수와 순환소수', '순환마디가 한 자리이면 그 숫자를 아홉으로 나눕니다.', r => { const a=r(1,8); return [`소수점 아래 숫자 ${a}만 끝없이 반복되는 순환소수의 값은?`, a/9]; });
    for (const [id, target, result] of [
        ['system-x', 'x', (x,y) => x], ['system-y', 'y', (x,y) => y],
        ['system-sum', 'x+y', (x,y) => x+y], ['system-difference', 'x−y', (x,y) => x-y]
    ]) add(5, id, '연립방정식', '두 식을 빼서 한 문자를 구한 뒤 대입하세요.', r => {
        const x=r(-5,8), y=r(-5,8), a=r(1,5), b=r(1,5);
        return [`${a}x + ${b}y = ${a*x+b*y}, ${a+1}x + ${b}y = ${(a+1)*x+b*y}일 때 ${target}의 값은?`, result(x,y)];
    });
    add(6, 'linear-value', '일차함수', '식에 주어진 가로좌표를 대입하세요.', r => { const a=r(1,6), b=r(-8,8), x=r(-5,5); return [`y=${a}x + (${b})에서 x=(${x})일 때 y는?`, a*x+b]; });
    add(6, 'linear-slope', '일차함수', '세로좌표의 변화량을 가로좌표의 변화량으로 나누세요.', r => { const x=r(-5,2), y=r(-5,5), dx=r(1,5), a=r(-4,4); return [`두 점 (${x}, ${y}), (${x+dx}, ${y+a*dx})를 지나는 직선의 기울기는?`, a]; });
    add(6, 'linear-intercept', '일차함수', '기울기와 한 점을 직선의 식에 대입하세요.', r => { const a=r(1,6), x=r(-5,5), b=r(-8,8); return [`기울기가 ${a}이고 점 (${x}, ${a*x+b})를 지나는 직선의 y절편은?`, b]; });
    add(6, 'linear-inverse', '일차함수', '세로좌표를 대입하여 일차방정식을 푸세요.', r => { const a=r(1,6), b=r(-8,8), x=r(-5,5); return [`y=${a}x + (${b})에서 y=(${a*x+b})일 때 x는?`, x]; });
    add(7, 'root-principal', '제곱근/실수', '근호는 음이 아닌 제곱근을 뜻합니다.', r => { const a=r(2,20); return [`√${a*a}의 값은?`, a]; });
    add(7, 'root-square', '제곱근/실수', '제곱한 수의 음이 아닌 제곱근은 원래 수의 절댓값입니다.', r => { const a=r(-15,-2); return [`√((${a})²)의 값은?`, Math.abs(a)]; });
    add(7, 'root-product', '제곱근/실수', '음이 아닌 수의 제곱근의 곱은 곱의 제곱근입니다.', r => { const a=r(2,8), b=r(2,8); return [`√${a*a} × √${b*b}의 값은?`, a*b]; });
    add(7, 'root-sum', '제곱근/실수', '각 제곱근을 구한 후 더하세요.', r => { const a=r(2,12), b=r(2,12); return [`√${a*a} + √${b*b}의 값은?`, a+b]; });
    for (const [id, target, result] of [
        ['quadratic-root-sum', '두 근의 합', (a,b) => a+b],
        ['quadratic-root-product', '두 근의 곱', (a,b) => a*b],
        ['quadratic-larger-root', '더 큰 근', (a,b) => Math.max(a,b)]
    ]) add(8, id, '인수분해/이차방정식', '인수분해하거나 근과 계수의 관계를 이용하세요.', r => {
        const a=r(-8,3), b=a+r(1,7);
        return [`x² + (${-a-b})x + (${a*b}) = 0의 ${target}은?`, result(a,b)];
    });
    add(8, 'factor-evaluate', '인수분해/이차방정식', '각 인수에 값을 대입하여 곱하세요.', r => { const a=r(-6,6), b=r(-6,6), x=r(-4,4); return [`P(x)=(x − (${a}))(x − (${b}))일 때 P(${x})의 값은?`, (x-a)*(x-b)]; });
    add(9, 'parabola-value', '이차함수', '제곱을 먼저 계산하세요.', r => { const a=r(1,4), b=r(-7,7), x=r(-4,4); return [`y=${a}x² + (${b})에서 x=(${x})일 때 y는?`, a*x*x+b]; });
    add(9, 'parabola-axis', '이차함수', '꼭짓점의 가로좌표가 대칭축을 결정합니다.', r => { const a=r(1,4), h=r(-5,5), k=r(-8,8); return [`y=${a}(x − (${h}))² + (${k})의 대칭축이 x=t일 때 t는?`, h]; });
    add(9, 'parabola-extreme', '이차함수', '제곱항의 계수 부호로 최솟값과 최댓값을 구별하세요.', r => { const a=r(1,4)*(r(0,1) ? 1 : -1), h=r(-5,5), k=r(-8,8); return [`y=${a}(x − (${h}))² + (${k})의 ${a>0 ? '최솟값' : '최댓값'}은?`, k]; });
    add(9, 'parabola-intercept', '이차함수', '가로좌표에 영을 대입하세요.', r => { const a=r(1,4), h=r(-5,5), k=r(-8,8); return [`y=${a}(x − (${h}))² + (${k})의 y절편은?`, a*h*h+k]; });
    add(10, 'remainder-quadratic', '다항식/나머지정리', '나누는 일차식의 근을 다항식에 대입하세요.', r => { const a=r(1,5), b=r(-5,5), c=r(-6,6), k=r(-4,4); return [`P(x)=${a}x² + (${b})x + (${c})를 x − (${k})로 나눈 나머지는?`, a*k*k+b*k+c]; });
    add(10, 'remainder-cubic', '다항식/나머지정리', '나머지정리에 따라 일차식의 근을 대입하세요.', r => { const a=r(1,4), b=r(-8,8), k=r(-3,3); return [`P(x)=${a}x³ + (${b})를 x − (${k})로 나눈 나머지는?`, a*k*k*k+b]; });
    add(10, 'polynomial-product', '다항식/나머지정리', '곱셈 전개에서 일차항을 만드는 곱들을 더하세요.', r => { const a=r(1,5), b=r(-6,6), c=r(1,5), d=r(-6,6); return [`(${a}x + (${b}))(${c}x + (${d}))를 전개했을 때 x의 계수는?`, a*d+b*c]; });
    add(10, 'remainder-recover-constant', '다항식/나머지정리', '대입한 값과 나머지가 같다는 방정식을 세우세요.', r => { const a=r(1,4), b=r(-5,5), k=r(-3,3), c=r(-9,9); return [`P(x)=${a}x² + (${b})x + c를 x − (${k})로 나눈 나머지가 ${a*k*k+b*k+c}일 때 상수 c는?`, c]; });
    add(11, 'root-distance', '방정식/부등식', '두 근을 구한 뒤 차이의 절댓값을 구하세요.', r => { const a=r(-8,3), b=a+r(1,8); return [`x² + (${-a-b})x + (${a*b}) = 0의 두 근 차이의 절댓값은?`, b-a]; });
    add(11, 'linear-inequality-count', '방정식/부등식', '부등식을 풀고 경계값을 포함하는지 확인하세요.', r => { const a=r(1,6), b=r(-8,8), n=r(2,12); return [`${a}x + (${b}) < ${a*n+b}를 만족하는 양의 정수 x의 개수는?`, n-1]; });
    add(11, 'quadratic-discriminant', '방정식/부등식', '판별식은 일차항 계수의 제곱에서 최고차항 계수와 상수의 곱의 네 배를 뺍니다.', r => { const a=r(1,5), b=r(-8,8), c=r(-6,6); return [`${a}x² + (${b})x + (${c}) = 0의 판별식 D는?`, b*b-4*a*c]; });
    add(11, 'quadratic-inequality-count', '방정식/부등식', '두 근 사이에서 곱이 영 이하이며 양 끝도 포함합니다.', r => { const a=r(-8,3), b=a+r(1,9); return [`(x − (${a}))(x − (${b})) ≤ 0을 만족하는 정수 x의 개수는?`, b-a+1]; });
    add(12, 'permutation', '함수/경우의 수', '순서가 있으므로 차례로 남은 인원수를 곱하세요.', r => { const n=r(4,8), k=r(2,n-1); let v=1; for(let i=0;i<k;i++) v*=n-i; return [`서로 다른 ${n}명 중 ${k}명을 뽑아 한 줄로 세우는 경우의 수는?`, v]; });
    add(12, 'combination', '함수/경우의 수', '순서를 구별하지 않는 조합입니다.', r => { const n=r(4,9), k=r(2,n-1); let v=1; for(let i=1;i<=k;i++) v=v*(n-i+1)/i; return [`서로 다른 ${n}명 중 순서 없이 ${k}명의 대표를 뽑는 경우의 수는?`, Math.round(v)]; });
    add(12, 'function-compose', '함수/경우의 수', '안쪽 함수를 계산한 뒤 바깥 함수에 대입하세요.', r => { const a=r(1,5), b=r(-5,5), c=r(1,5), d=r(-5,5), x=r(-3,3); return [`f(x)=${a}x + (${b}), g(x)=${c}x + (${d})일 때 f(g(${x}))의 값은?`, a*(c*x+d)+b]; });
    add(12, 'function-inverse', '함수/경우의 수', '함수값이 주어진 수가 되는 입력값을 구하세요.', r => { const a=r(1,6), b=r(-8,8), x=r(-5,5); return [`실수 전체에서 f(x)=${a}x + (${b})일 때 역함수 f⁻¹(${a*x+b})의 값은?`, x]; });
    add(13, 'exponent-product', '지수·로그', '밑이 같은 거듭제곱의 곱은 지수를 더합니다.', r => { const a=r(2,5), m=r(1,3), n=r(1,3); return [`${a}^${m} × ${a}^${n}의 값은?`, a**(m+n)]; });
    add(13, 'exponent-quotient', '지수·로그', '밑이 같은 거듭제곱의 나눗셈은 지수를 뺍니다.', r => { const a=r(2,5), n=r(1,3), m=n+r(1,3); return [`${a}^${m} ÷ ${a}^${n}의 값은?`, a**(m-n)]; });
    add(13, 'logarithm-value', '지수·로그', '밑을 몇 번 거듭제곱해야 진수가 되는지 생각하세요.', r => { const a=r(2,5), n=r(1,5); return [`밑이 ${a}이고 진수가 ${a**n}인 로그의 값은?`, n]; });
    add(13, 'exponential-equation', '지수·로그', '우변을 좌변과 같은 밑의 거듭제곱으로 나타내세요.', r => { const a=r(2,5), n=r(1,5); return [`${a}^x = ${a**n}을 만족하는 실수 x는?`, n]; });
    const sine = [[0,0],[30,0.5],[90,1],[150,0.5],[180,0],[270,-1]];
    const cosine = [[0,1],[60,0.5],[90,0],[120,-0.5],[180,-1],[270,0]];
    const tangent = [[0,0],[45,1],[135,-1],[180,0]];
    for (const [id, name, table] of [['trig-sine','sin',sine],['trig-cosine','cos',cosine],['trig-tangent','tan',tangent]]) {
        add(14, id, '삼각함수', '특수각의 값과 사분면에 따른 부호를 확인하세요.', r => { const [angle,value]=table[r(0,table.length-1)]; return [`${name} ${angle}°의 값은?`, value]; });
    }
    add(14, 'trig-triangle', '삼각함수', '사인은 대변의 길이를 빗변의 길이로 나눈 값입니다.', r => { const length=2*r(2,12); return [`직각삼각형의 빗변 길이가 ${length}이고 한 예각이 30°일 때, 그 예각의 대변 길이는?`, length/2]; });
    add(15, 'arithmetic-nth', '수열', '첫항에 항 번호보다 하나 적은 횟수만큼 공차를 더하세요.', r => { const a=r(-5,10), d=r(1,8), n=r(3,12); return [`첫항 ${a}, 공차 ${d}인 등차수열의 제${n}항은?`, a+(n-1)*d]; });
    add(15, 'arithmetic-sum', '수열', '첫항과 마지막 항의 합에 항의 개수를 곱하고 둘로 나누세요.', r => { const a=r(1,10), d=r(1,8), n=r(3,12); return [`첫항 ${a}, 공차 ${d}인 등차수열의 첫 ${n}항의 합은?`, n*(2*a+(n-1)*d)/2]; });
    add(15, 'arithmetic-recover-d', '수열', '주어진 항과 첫항의 차이를 이동한 간격 수로 나누세요.', r => { const a=r(-5,10), d=r(1,8), n=r(3,12); return [`첫항이 ${a}이고 제${n}항이 ${a+(n-1)*d}인 등차수열의 공차는?`, d]; });
    add(15, 'arithmetic-recover-a', '수열', '등차수열의 합 공식에 주어진 값을 넣어 첫항을 구하세요.', r => { const a=r(-5,10), d=r(1,8), n=r(3,12); return [`공차가 ${d}이고 첫 ${n}항의 합이 ${n*(2*a+(n-1)*d)/2}인 등차수열의 첫항은?`, a]; });
    add(15, 'geometric-nth', '수열', '첫항에 공비를 항 번호보다 하나 적은 횟수만큼 곱하세요.', r => { const a=r(1,6), q=r(2,4), n=r(3,6); return [`첫항 ${a}, 공비 ${q}인 등비수열의 제${n}항은?`, a*q**(n-1)]; });
    add(15, 'geometric-sum', '수열', '각 항을 더하거나 등비수열의 합 공식을 이용하세요.', r => { const a=r(1,6), q=r(2,4), n=r(3,6); return [`첫항 ${a}, 공비 ${q}인 등비수열의 첫 ${n}항의 합은?`, a*(q**n-1)/(q-1)]; });
    add(16, 'derivative-cubic', '미분', '각 항을 미분한 뒤 주어진 값을 대입하세요.', r => { const a=r(1,5), b=r(-4,4), c=r(-5,5), x=r(-3,4); return [`f(x)=${a}x³ + (${b})x² + (${c})x일 때 f′(${x})의 값은?`, 3*a*x*x+2*b*x+c]; });
    add(16, 'derivative-tangent-slope', '미분', '접선의 기울기는 그 점에서의 미분계수입니다.', r => { const a=r(1,5), b=r(-5,5), c=r(-5,5), x=r(-3,4); return [`f(x)=${a}x² + (${b})x + (${c})의 그래프에서 x=(${x})인 점의 접선 기울기는?`, 2*a*x+b]; });
    add(16, 'derivative-stationary', '미분', '도함수가 영이 되는 일차방정식을 푸세요.', r => { const a=r(1,5), x=r(-4,4), c=r(-5,5), b=-2*a*x; return [`f(x)=${a}x² + (${b})x + (${c})일 때 f′(x)=0을 만족하는 x는?`, x]; });
    add(16, 'derivative-second', '미분', '차례로 두 번 미분한 뒤 값을 대입하세요.', r => { const a=r(1,4), b=r(-4,4), c=r(-5,5), x=r(-3,4); return [`f(x)=${a}x³ + (${b})x² + (${c})x일 때 f″(${x})의 값은?`, 6*a*x+2*b]; });
    add(17, 'integral-linear', '적분', '원시함수의 위끝값에서 아래끝값을 빼세요.', r => { const lo=r(-3,2), hi=lo+r(1,5), a=r(1,5), b=r(-5,5); return [`구간 [${lo}, ${hi}]에서 함수 f(x)=${a}x + (${b})의 정적분 값은?`, a*(hi*hi-lo*lo)/2+b*(hi-lo)]; });
    add(17, 'probability-single', '확률과 통계', '각 공을 뽑을 가능성이 같으므로 빨간 공 수를 전체 수로 나누세요.', r => { const success=r(2,6), total=success+r(2,6); return [`빨간 공 ${success}개를 포함해 공이 총 ${total}개 있다. 무작위로 한 개를 뽑을 때 빨간 공일 확률은?`, success/total]; });
    add(17, 'probability-without-replacement', '확률과 통계', '첫 공을 꺼낸 뒤 빨간 공 수와 전체 공 수가 각각 하나 줄어듭니다.', r => { const success=r(2,6), total=success+r(2,6); return [`빨간 공 ${success}개를 포함해 공이 총 ${total}개 있다. 되돌려 놓지 않고 두 개를 차례로 무작위로 뽑을 때 둘 다 빨간 공일 확률은?`, success/total*(success-1)/(total-1)]; });
    add(17, 'vector-dot', '기하', '같은 위치의 성분끼리 곱한 뒤 더하세요.', r => { const a=r(-5,5), b=r(-5,5), c=r(-5,5), d=r(-5,5); return [`벡터 (${a}, ${b})와 (${c}, ${d})의 내적은?`, a*c+b*d]; });
    add(18, 'composite-derivative-shift', '수능 종합', '먼저 도함수를 구한 뒤 새로운 함수에 대입하세요.', r => { const a=r(1,5), b=r(-5,5), c=r(-6,6), x=r(-3,4); return [`f(x)=${a}x² + (${b})x, g(x)=f′(x) + (${c})일 때 g(${x})의 값은?`, 2*a*x+b+c]; });
    add(18, 'composite-tangent-intercept', '수능 종합', '미분으로 접선 기울기를 구하고 접점 좌표로 절편을 구하세요.', r => { const a=r(1,5), b=r(-5,5), c=r(-6,6), x=r(-3,4); return [`f(x)=${a}x² + (${b})x + (${c})의 그래프에서 x=(${x})인 점의 접선의 y절편은?`, c-a*x*x]; });
    add(18, 'composite-integral-derivative', '수능 종합', '도함수의 정적분은 원래 함수의 양 끝값의 차이입니다.', r => { const a=r(1,5), b=r(-5,5), lo=r(-3,2), hi=lo+r(1,5); return [`f(x)=${a}x² + (${b})x일 때 구간 [${lo}, ${hi}]에서 f′(x)의 정적분 값은?`, a*(hi*hi-lo*lo)+b*(hi-lo)]; });
    add(18, 'composite-sequence-function', '수능 종합', '등차수열의 항을 먼저 구한 뒤 함수에 대입하세요.', r => { const a=r(1,6), d=r(1,4), n=r(3,7), c=r(1,3), b=r(-6,6), term=a+(n-1)*d; return [`첫항 ${a}, 공차 ${d}인 등차수열의 제${n}항을 t라 하자. f(x)=${c}x² + (${b})일 때 f(t)의 값은?`, c*term*term+b]; });
    /** Each instance owns its per-level shuffled bags. RNG follows Math.random's [0, 1) contract.
     * reset() clears scheduling history, but does not rewind the caller-owned RNG.
     * Finite number/string levels are rounded then clamped to 1..18; invalid input throws.
     */
    function createGenerator(options = {}) {
        const random = options.random === undefined ? Math.random : options.random;
        if (typeof random !== 'function') throw new TypeError('random must be a function');
        const bags = new Map();
        const previous = new Map();
        const int = (a, b) => {
            const value = random();
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) {
                throw new RangeError('random must return a finite number in [0, 1)');
            }
            return Math.floor(value * (b - a + 1)) + a;
        };
        function generate(level) {
            if ((typeof level !== 'number' && typeof level !== 'string') ||
                (typeof level === 'string' && !level.trim()) || !Number.isFinite(Number(level))) {
                throw new RangeError('level must be a finite number');
            }
            level = Math.max(1, Math.min(18, Math.round(Number(level))));
            const pool = templates[level];
            let bag = bags.get(level);
            if (!bag || !bag.length) {
                bag = pool.map((_, i) => i);
                for (let i = bag.length - 1; i > 0; i--) {
                    const j = int(0, i);
                    [bag[i], bag[j]] = [bag[j], bag[i]];
                }
                if (bag.length > 1 && bag[bag.length - 1] === previous.get(level)) {
                    [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
                }
                bags.set(level, bag);
            }
            const index = bag.pop();
            previous.set(level, index);
            return { level, difficulty: level, ...pool[index](int) };
        }
        return { generate, reset() { bags.clear(); previous.clear(); } };
    }
    const generator = createGenerator();
    return { createGenerator, generate: generator.generate, reset: generator.reset };
}));
