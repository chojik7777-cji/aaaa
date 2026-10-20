/* Curriculum-aligned numeric questions. No DOM, storage, or network side effects. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MathProblems = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const templates = {};
    function add(level, id, type, hint, build) {
        (templates[level] || (templates[level] = [])).push(int => {
            // Record, rather than repeat, the builder's draws: scheduling and RNG consumption stay unchanged.
            const params = [];
            const [text, answer] = build((lo, hi) => {
                const value = int(lo, hi);
                params.push(value);
                return value;
            });
            return { text, answer, type, hint, templateId: id, solutionSteps: explain(id, params, answer) };
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
    // Explanations use raw draw parameters, never question-text parsing or further randomness.
    // Each branch states a principle, performs the actual arithmetic, and concludes explicitly.
    function explain(id, p, answer) {
        const done = steps => [...steps, `정답: ${Object.is(answer, -0) ? 0 : answer}`];
        const fraction = (steps, numerator, denominator) => {
            const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
            const g = gcd(numerator, denominator);
            const exact = `${numerator / g}/${denominator / g}`;
            const rounded = (Math.round(answer * 100) / 100).toFixed(2);
            return [...steps,
                `정확한 분수는 ${numerator}/${denominator} = ${exact}입니다. 분자와 분모를 최대공약수 ${g}로 나누어 약분합니다.`,
                `분자를 분모로 나눈 뒤 소수 셋째 자리에서 반올림하여 소수 둘째 자리까지 나타내면 ${exact} ≈ ${rounded}입니다. 정확한 값이 소수 둘째 자리 이내의 유한소수이면 값은 변하지 않습니다.`,
                `정답: ${rounded}`];
        };
        switch (id) {
        case 'integer-add': {
            const [a,b]=p;
            return done(['같은 부호의 정수는 절댓값을 더하고, 다른 부호는 절댓값의 차에 절댓값이 큰 수의 부호를 붙입니다.',
                `주어진 수의 절댓값은 |${a}| = ${Math.abs(a)}, |${b}| = ${Math.abs(b)}입니다.`,
                a*b<0 ? `부호가 다르므로 ${Math.max(Math.abs(a),Math.abs(b))} − ${Math.min(Math.abs(a),Math.abs(b))} = ${Math.abs(a+b)}이고, 합은 ${a+b}입니다.` : `같은 부호이거나 0을 더하므로 (${a}) + (${b}) = ${a+b}입니다.`]);
        }
        case 'integer-subtract': {
            const [a,b]=p;
            return done(['뺄셈은 빼는 수의 부호를 바꾸어 더하는 계산입니다: a − b = a + (−b).',
                `빼는 수 (${b})의 반대 수는 ${-b}이므로 (${a}) − (${b}) = (${a}) + (${-b})입니다.`,
                `정수의 덧셈 규칙을 적용하면 (${a}) + (${-b}) = ${a-b}입니다.`]);
        }
        case 'integer-multiply': {
            const [a,b]=p;
            return done(['두 수의 부호가 같으면 곱은 양수, 다르면 음수이며, 0이 있으면 곱은 0입니다.',
                `절댓값끼리 곱하면 |${a}| × |${b}| = ${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(a*b)}입니다.`,
                `부호를 적용하면 (${a}) × (${b}) = ${a*b}입니다.`]);
        }
        case 'integer-divide': {
            const [a,b]=p;
            return done(['나눗셈은 곱셈의 역연산입니다. 나누는 수가 양수이면 몫의 부호는 나누어지는 수의 부호와 같습니다.',
                `나누어지는 수는 ${a*b}, 나누는 수는 ${b}이며 ${b} × (${a}) = ${a*b}입니다.`,
                `따라서 (${a*b}) ÷ ${b} = ${a}이고, 몫에 ${b}를 곱하면 원래 수 ${a*b}가 됩니다.`]);
        }
        case 'expression-linear': {
            const [x,a,b]=p;
            return done(['문자의 값을 대입한 뒤 곱셈을 덧셈보다 먼저 합니다.',`x=(${x})를 대입하면 ${a}x + (${b}) = ${a} × (${x}) + (${b})입니다.`,
                `먼저 ${a} × (${x}) = ${a*x}, 이어서 (${a*x}) + (${b}) = ${a*x+b}입니다.`]);
        }
        case 'expression-square': {
            const [x,a,b]=p;
            return done(['제곱은 같은 수를 두 번 곱하는 것입니다. 음수를 대입할 때는 괄호 전체를 제곱합니다.',
                `x=(${x})이므로 x² = (${x}) × (${x}) = ${x*x}입니다.`,
                `따라서 ${a} × ${x*x} + (${b}) = ${a*x*x} + (${b}) = ${a*x*x+b}입니다.`]);
        }
        case 'expression-distribute': {
            const [x,a,b]=p;
            return done(['괄호 안에 값을 대입하고, 괄호 안의 덧셈부터 계산합니다.',`x=(${x})이면 x + (${b}) = (${x}) + (${b}) = ${x+b}입니다.`,
                `이 값에 괄호 밖의 ${a}를 곱하면 ${a} × (${x+b}) = ${a*(x+b)}입니다.`]);
        }
        case 'expression-two-variables': {
            const [x,y,a,b]=p;
            return done(['두 문자에 주어진 값을 각각 대입한 다음 각 항을 계산하여 더합니다.',
                `${a}x = ${a} × (${x}) = ${a*x}, ${b}y = ${b} × (${y}) = ${b*y}입니다.`,
                `두 항의 합은 (${a*x}) + (${b*y}) = ${a*x+b*y}입니다.`]);
        }
        case 'equation-linear': {
            const [x,a,b]=p, rhs=a*x+b;
            return done(['등식의 양변에 같은 수를 더하거나 빼고, 0이 아닌 같은 수로 나누어도 해는 같습니다.',
                `양변에서 (${b})를 빼면 ${a}x = (${rhs}) − (${b}) = ${a*x}입니다.`,
                `양변을 ${a}로 나누면 x = (${a*x}) ÷ ${a} = ${x}입니다.`]);
        }
        case 'equation-both-sides': {
            const [x,c,delta,b]=p,a=c+delta,rhs=delta*x+b;
            return done(['양변의 문자항을 한쪽으로 모으고 상수항을 다른 쪽으로 모읍니다.',
                `양변에서 ${c}x와 (${b})를 빼면 (${a} − ${c})x = (${rhs}) − (${b})입니다.`,
                `정리하면 ${delta}x = ${delta*x}이고, x = (${delta*x}) ÷ ${delta} = ${x}입니다.`]);
        }
        case 'equation-brackets': {
            const [x,a,b]=p,rhs=a*(x+b);
            return done(['먼저 양변을 괄호의 계수로 나누고, 괄호 안의 상수항을 없앱니다.',
                `양변을 ${a}로 나누면 x + (${b}) = (${rhs}) ÷ ${a} = ${x+b}입니다.`,
                `양변에서 (${b})를 빼면 x = (${x+b}) − (${b}) = ${x}입니다.`]);
        }
        case 'equation-fraction': {
            const [a,b,c]=p;
            return done(['양변에서 상수항을 빼고 분모를 곱하여 x를 구합니다.',
                `양변에서 (${b})를 빼면 x/${a} = (${c}) − (${b}) = ${c-b}입니다.`,
                `양변에 ${a}를 곱하면 x = ${a} × (${c-b}) = ${a*(c-b)}입니다.`]);
        }
        case 'rational-add': {
            const [a,b,c,d]=p;
            return fraction(['분수의 덧셈은 통분하여 분모를 같게 만든 뒤 분자끼리 더합니다.',
                `공통분모를 ${b} × ${d} = ${b*d}로 잡으면 ${a}/${b} = ${a*d}/${b*d}, ${c}/${d} = ${c*b}/${b*d}입니다.`,
                `따라서 (${a*d} + ${c*b})/${b*d} = ${a*d+c*b}/${b*d}입니다.`],a*d+c*b,b*d);
        }
        case 'rational-multiply': {
            const [a,b,c,d]=p;
            return fraction(['분수의 곱셈은 분자끼리 곱하고 분모끼리 곱합니다.',
                `분자의 곱은 ${a} × ${c} = ${a*c}, 분모의 곱은 ${b} × ${d} = ${b*d}입니다.`,
                `따라서 ${a}/${b} × ${c}/${d} = ${a*c}/${b*d}입니다.`],a*c,b*d);
        }
        case 'decimal-fraction': {
            const [a]=p;
            return fraction(['분모가 100인 분수는 백분의 일 단위이므로 분자를 100으로 나눕니다.',
                `${a}/100 = ${a} ÷ 100 = ${(a/100).toFixed(2)}이며 소수점을 왼쪽으로 두 자리 옮긴 값입니다.`],a,100);
        }
        case 'repeating-decimal': {
            const [a]=p;
            return fraction(['순환소수를 x라 놓고 10배 하면 같은 순환 부분을 빼서 없앨 수 있습니다.',
                `x = 0.${a}${a}${a}…라 놓으면 10x = ${a}.${a}${a}${a}…입니다.`,
                `10x − x = ${a}이므로 9x = ${a}, 따라서 x = ${a}/9입니다.`],a,9);
        }
        case 'system-x': case 'system-y': case 'system-sum': case 'system-difference': {
            const [x,y,a,b]=p,first=a*x+b*y,second=(a+1)*x+b*y;
            const target=id==='system-x'?`구할 값은 x = ${x}입니다.`:id==='system-y'?`구할 값은 y = ${y}입니다.`:id==='system-sum'?`구할 합은 x+y = (${x}) + (${y}) = ${x+y}입니다.`:`구할 차는 x−y = (${x}) − (${y}) = ${x-y}입니다.`;
            return done(['두 식의 y 계수가 같으므로 둘째 식에서 첫째 식을 빼면 y가 소거됩니다.',
                `((${a+1}) − ${a})x + (${b} − ${b})y = (${second}) − (${first})이므로 x = ${x}입니다.`,
                `첫째 식에 x=(${x})를 대입하면 ${a} × (${x}) + ${b}y = ${first}입니다.`,
                `${b}y = (${first}) − (${a*x}) = ${b*y}이므로 y = (${b*y}) ÷ ${b} = ${y}입니다.`,target]);
        }
        case 'linear-value': {
            const [a,b,x]=p;
            return done(['함수식에 주어진 x좌표를 대입하면 대응하는 y좌표를 얻습니다.',
                `y = ${a} × (${x}) + (${b})이고, 곱셈 부분은 ${a} × (${x}) = ${a*x}입니다.`,
                `따라서 y = (${a*x}) + (${b}) = ${a*x+b}입니다.`]);
        }
        case 'linear-slope': {
            const [x,y,dx,a]=p;
            return done(['기울기 = y의 변화량 / x의 변화량입니다. 두 점을 같은 순서로 뺍니다.',
                `x의 변화량은 (${x+dx}) − (${x}) = ${dx}, y의 변화량은 (${y+a*dx}) − (${y}) = ${a*dx}입니다.`,
                `따라서 기울기 = ${a*dx}/${dx} = ${a}입니다. x의 변화량 ${dx}는 0이 아니므로 나눌 수 있습니다.`]);
        }
        case 'linear-intercept': {
            const [a,x,b]=p,y=a*x+b;
            return done(['기울기가 a인 직선은 y=ax+b이며 y절편은 b입니다.',
                `주어진 점 (${x}, ${y})를 대입하면 ${y} = ${a} × (${x}) + b입니다.`,
                `따라서 b = (${y}) − (${a*x}) = ${b}입니다.`]);
        }
        case 'linear-inverse': {
            const [a,b,x]=p,y=a*x+b;
            return done(['주어진 y값을 함수식에 넣고 양변에서 상수항을 빼서 x를 구합니다.',
                `${y} = ${a}x + (${b})이므로 ${a}x = (${y}) − (${b}) = ${a*x}입니다.`,
                `양변을 ${a}로 나누면 x = (${a*x}) ÷ ${a} = ${x}입니다.`]);
        }
        case 'root-principal': {
            const [a]=p;
            return done(['√A는 제곱해서 A가 되는 수 중 음이 아닌 제곱근을 뜻합니다.',
                `${a}² = ${a} × ${a} = ${a*a}이고, (${-a})²도 ${a*a}입니다.`,
                `두 제곱근 중 음이 아닌 수를 선택하므로 √${a*a} = ${a}입니다.`]);
        }
        case 'root-square': {
            const [a]=p;
            return done(['실수 a에 대해 √(a²) = |a|, 즉 a의 절댓값입니다. 제곱근 기호의 값은 항상 음이 아닙니다.',
                `(${a})² = (${a}) × (${a}) = ${a*a}입니다.`,
                `${a}는 음수이므로 |${a}| = −(${a}) = ${-a}이며 √${a*a} = ${-a}입니다.`]);
        }
        case 'root-product': {
            const [a,b]=p;
            return done(['각 근호의 음이 아닌 제곱근을 먼저 구하여 곱합니다.',
                `${a}² = ${a*a}, ${b}² = ${b*b}이므로 √${a*a} = ${a}, √${b*b} = ${b}입니다.`,
                `따라서 √${a*a} × √${b*b} = ${a} × ${b} = ${a*b}입니다.`]);
        }
        case 'root-sum': {
            const [a,b]=p;
            return done(['제곱근의 합은 각 제곱근을 각각 계산한 뒤 더합니다. 일반적으로 √A+√B는 √(A+B)가 아닙니다.',
                `${a}² = ${a*a}, ${b}² = ${b*b}이므로 음이 아닌 제곱근은 각각 ${a}, ${b}입니다.`,
                `따라서 √${a*a} + √${b*b} = ${a} + ${b} = ${a+b}입니다.`]);
        }
        case 'quadratic-root-sum': case 'quadratic-root-product': case 'quadratic-larger-root': case 'root-distance': {
            const [a,gap]=p,b=a+gap,B=-a-b,C=a*b,D=B*B-4*C;
            const last=id==='quadratic-root-sum'?`근과 계수의 관계로 두 근의 합은 −(${-a-b}) = (${a}) + (${b}) = ${a+b}입니다.`:
                id==='quadratic-root-product'?`근과 계수의 관계로 두 근의 곱은 (${a}) × (${b}) = ${a*b}입니다.`:
                id==='quadratic-larger-root'?`${a} < ${b}이므로 두 근을 비교하면 더 큰 근은 ${b}입니다.`:
                `두 근 차이의 절댓값은 |(${b}) − (${a})| = |${gap}| = ${gap}입니다.`;
            return done(['인수분해하여 곱이 0이면 적어도 한 인수가 0이라는 성질을 씁니다.',
                `두 수 ${a}, ${b}의 합은 ${a+b}, 곱은 ${C}이므로 x² + (${B})x + (${C}) = (x − (${a}))(x − (${b}))입니다.`,
                `따라서 x − (${a}) = 0 또는 x − (${b}) = 0이므로 두 근은 ${a}, ${b}입니다.`,
                `판별식 D = (${B})² − 4 × (${C}) = ${D} > 0이므로 서로 다른 두 실근입니다.`,last]);
        }
        case 'factor-evaluate': {
            const [a,b,x]=p;
            return done(['인수분해된 식은 전개하지 않고 각 인수에 같은 x값을 대입하여 곱할 수 있습니다.',
                `첫 인수는 (${x}) − (${a}) = ${x-a}, 둘째 인수는 (${x}) − (${b}) = ${x-b}입니다.`,
                `따라서 P(${x}) = (${x-a}) × (${x-b}) = ${(x-a)*(x-b)}입니다.`]);
        }
        case 'parabola-value': {
            const [a,b,x]=p;
            return done(['이차함수의 값을 구할 때는 x를 대입하고 제곱, 곱셈, 덧셈 순서로 계산합니다.',
                `x=(${x})이므로 x² = (${x})² = ${x*x}입니다.`,
                `따라서 y = ${a} × ${x*x} + (${b}) = ${a*x*x} + (${b}) = ${a*x*x+b}입니다.`]);
        }
        case 'parabola-axis': {
            const [a,h,k]=p;
            return done(['꼭짓점형 y=a(x−h)²+k의 대칭축은 꼭짓점을 지나는 수직선 x=h입니다.',
                `제곱항이 0이 되는 조건은 x − (${h}) = 0, 즉 x = ${h}입니다. 이때 y = ${a} × 0 + (${k}) = ${k}입니다.`,
                `꼭짓점은 (${h}, ${k})이고 대칭축은 x=${h}이므로 t=${h}입니다.`]);
        }
        case 'parabola-extreme': {
            const [m,positive,h,k]=p,a=m*(positive?1:-1);
            return done(['모든 실수 x에 대해 (x−h)² ≥ 0이며, 계수가 양수이면 최솟값, 음수이면 최댓값을 가집니다.',
                `계수 ${a}가 ${a>0?'양수':'음수'}이므로 ${a}(x − (${h}))² ${a>0?'≥':'≤'} 0입니다.`,
                `따라서 y ${a>0?'≥':'≤'} ${k}이고 x=${h}일 때 y = ${a} × 0 + (${k}) = ${k}로 등호가 성립합니다.`,
                `그러므로 함수의 ${a>0?'최솟값':'최댓값'}은 ${k}입니다.`]);
        }
        case 'parabola-intercept': {
            const [a,h,k]=p;
            return done(['y절편은 그래프가 y축과 만나는 점의 y좌표이며 x=0을 대입하여 구합니다.',
                `x=0이면 (0 − (${h}))² = (${-h})² = ${h*h}입니다.`,
                `따라서 y = ${a} × ${h*h} + (${k}) = ${a*h*h} + (${k}) = ${a*h*h+k}입니다.`]);
        }
        case 'remainder-quadratic': {
            const [a,b,c,k]=p;
            return done(['나머지정리: P(x)를 x−k로 나눈 나머지는 P(k)입니다. 나누는 식이 0이 되는 x를 대입합니다.',
                `x − (${k}) = 0의 해는 x=${k}이므로 나머지는 P(${k}) = ${a} × (${k})² + (${b}) × (${k}) + (${c})입니다.`,
                `각 항은 ${a*k*k}, ${b*k}, ${c}이므로 나머지는 (${a*k*k}) + (${b*k}) + (${c}) = ${a*k*k+b*k+c}입니다.`]);
        }
        case 'remainder-cubic': {
            const [a,b,k]=p;
            return done(['나머지정리에 의해 x−k로 나눈 나머지는 P(k)입니다. 음수의 세제곱은 음수입니다.',
                `x − (${k}) = 0이므로 x=${k}를 대입하고 (${k})³ = ${k*k*k}을 계산합니다.`,
                `나머지는 P(${k}) = ${a} × (${k*k*k}) + (${b}) = (${a*k*k*k}) + (${b}) = ${a*k*k*k+b}입니다.`]);
        }
        case 'polynomial-product': {
            const [a,b,c,d]=p;
            return done(['전개했을 때 일차항은 한 인수의 x항과 다른 인수의 상수항을 곱한 두 항에서 나옵니다.',
                `(${a}x) × (${d}) = (${a*d})x, (${b}) × (${c}x) = (${b*c})x입니다.`,
                `따라서 일차항의 계수는 (${a*d}) + (${b*c}) = ${a*d+b*c}입니다. 이차항과 상수항은 x의 계수에 더하지 않습니다.`]);
        }
        case 'remainder-recover-constant': {
            const [a,b,k,c]=p,r=a*k*k+b*k+c;
            return done(['나머지정리에 따라 P(k)가 주어진 나머지와 같다는 방정식을 세웁니다.',
                `P(${k}) = ${a} × (${k})² + (${b}) × (${k}) + c = ${r}입니다.`,
                `이미 아는 두 항은 ${a*k*k}, ${b*k}이므로 c = (${r}) − (${a*k*k}) − (${b*k}) = ${c}입니다.`]);
        }
        case 'linear-inequality-count': {
            const [a,b,n]=p,rhs=a*n+b;
            return done(['부등식 양변에서 같은 수를 빼고 양수로 나누면 부등호 방향은 유지됩니다.',
                `${a}x + (${b}) < ${rhs}에서 ${a}x < (${rhs}) − (${b}) = ${a*n}입니다.`,
                `양수 ${a}로 나누면 x < ${n}입니다. 엄격한 부등호이므로 경계값 ${n}은 포함하지 않습니다.`,
                `양의 정수 조건까지 적용하면 1 ≤ x ≤ ${n-1}이므로 개수는 (${n-1}) − 1 + 1 = ${n-1}개입니다.`]);
        }
        case 'quadratic-discriminant': {
            const [a,b,c]=p,D=b*b-4*a*c;
            return done(['이차방정식 ax²+bx+c=0의 판별식은 D = b² − 4ac입니다.',
                `a=${a}, b=${b}, c=${c}이므로 b² = (${b})² = ${b*b}, 4ac = 4 × ${a} × (${c}) = ${4*a*c}입니다.`,
                `따라서 D = ${b*b} − (${4*a*c}) = ${D}입니다.`,
                D<0?`D=${D} < 0이므로 실근이 없습니다. 판별식 자체의 음수 값이 정답입니다.`:D===0?'D=0이므로 중근을 가집니다.':`D=${D} > 0이므로 서로 다른 두 실근을 가집니다.`]);
        }
        case 'quadratic-inequality-count': {
            const [a,gap]=p,b=a+gap;
            return done(['두 일차식의 곱은 두 근 사이에서 0 이하입니다. 부등호가 ≤이므로 양 끝도 포함합니다.',
                `두 경계는 x=${a}, x=${b}입니다. ${a} ≤ x ≤ ${b}에서는 첫 인수가 0 이상, 둘째 인수가 0 이하이므로 곱이 0 이하입니다.`,
                `구간 밖에서는 두 인수의 부호가 같아 곱이 양수이므로 제외합니다. 가능한 정수는 ${Array.from({length:gap+1},(_,i)=>a+i).join(', ')}입니다.`,
                `음수 경계도 같은 방법으로 세면 ${b} − (${a}) + 1 = ${b-a+1}개입니다.`]);
        }
        case 'permutation': case 'combination': {
            const [n,k]=p,terms=Array.from({length:k},(_,i)=>n-i),v=terms.reduce((a,b)=>a*b,1),fac=Array.from({length:k},(_,i)=>i+1).reduce((a,b)=>a*b,1);
            return done(id==='permutation'?['순서를 구별하여 뽑아 세우므로 순열을 사용합니다. 한 명을 세울 때마다 남은 인원은 한 명씩 줄어듭니다.',
                `처음 자리에는 ${n}명, 다음 자리에는 ${n-1}명을 놓을 수 있으며 ${k}번째 자리에는 ${n-k+1}명이 남습니다.`,
                `곱의 법칙으로 ${n}P${k} = ${terms.join(' × ')} = ${v}가지입니다.`]:
                ['대표를 뽑는 순서는 구별하지 않으므로 순열에서 같은 대표 집합이 중복된 횟수를 나눕니다.',
                `순서를 구별하면 ${n}P${k} = ${terms.join(' × ')} = ${v}가지입니다.`,
                `같은 ${k}명은 ${k}! = ${Array.from({length:k},(_,i)=>i+1).join(' × ')} = ${fac}가지 순서로 나타납니다.`,
                `따라서 ${n}C${k} = ${v}/${fac} = ${Math.round(v/fac)}가지입니다.`]);
        }
        case 'function-compose': {
            const [a,b,c,d,x]=p,g=c*x+d;
            return done(['합성함수 f(g(x))는 안쪽 함수 g를 먼저 계산한 뒤 그 값을 바깥 함수 f의 입력으로 넣습니다.',
                `g(${x}) = ${c} × (${x}) + (${d}) = (${c*x}) + (${d}) = ${g}입니다.`,
                `f(g(${x})) = f(${g}) = ${a} × (${g}) + (${b}) = (${a*g}) + (${b}) = ${a*g+b}입니다.`]);
        }
        case 'function-inverse': {
            const [a,b,x]=p,y=a*x+b;
            return done(['역함수 f⁻¹(y)는 함수값이 y가 되게 하는 입력을 뜻합니다. 기울기가 0이 아니므로 그 입력은 유일합니다.',
                `입력을 t라 놓으면 f(t)=${y}, 즉 ${a}t + (${b}) = ${y}입니다.`,
                `${a}t = (${y}) − (${b}) = ${a*x}이므로 t = (${a*x})/${a} = ${x}입니다.`,
                `확인하면 f(${x}) = ${a} × (${x}) + (${b}) = ${y}이므로 역함수 값은 ${x}입니다.`]);
        }
        case 'exponent-product': {
            const [a,m,n]=p;
            return done(['밑이 같은 거듭제곱끼리 곱할 때는 지수를 더합니다: a^m × a^n = a^(m+n).',
                `밑은 ${a}로 같고 지수의 합은 ${m} + ${n} = ${m+n}입니다.`,
                `따라서 ${a}^${m} × ${a}^${n} = ${a}^${m+n} = ${a**(m+n)}입니다.`]);
        }
        case 'exponent-quotient': {
            const [a,n,gap]=p,m=n+gap;
            return done(['0이 아닌 같은 밑의 거듭제곱을 나눌 때는 지수를 뺍니다: a^m ÷ a^n = a^(m−n).',
                `밑은 ${a}로 같고 지수의 차는 ${m} − ${n} = ${gap}입니다.`,
                `따라서 ${a}^${m} ÷ ${a}^${n} = ${a}^${gap} = ${a**gap}입니다.`]);
        }
        case 'logarithm-value': case 'exponential-equation': {
            const [a,n]=p,value=a**n;
            return done([id==='logarithm-value'?'로그의 정의는 log_a B = t일 필요충분조건이 a^t = B라는 것입니다.':'밑이 양수이고 1이 아니면 지수함수는 일대일이므로 같은 밑으로 나타낸 두 거듭제곱의 지수는 같습니다.',
                `${a} > 0이고 ${a} ≠ 1입니다. 주어진 수 ${value}는 ${Array(n).fill(a).join(' × ')} = ${a}^${n}입니다.`,
                id==='logarithm-value'?`${a}를 ${n}번 곱하면 ${value}가 되므로 log_${a}(${value}) = ${n}입니다.`:`${a}^x = ${a}^${n}이므로 지수를 비교하면 x=${n}입니다.`]);
        }
        case 'trig-sine': case 'trig-cosine': case 'trig-tangent': {
            const tables={ 'trig-sine':[[0,0],[30,0.5],[90,1],[150,0.5],[180,0],[270,-1]], 'trig-cosine':[[0,1],[60,0.5],[90,0],[120,-0.5],[180,-1],[270,0]], 'trig-tangent':[[0,0],[45,1],[135,-1],[180,0]] };
            const [angle,value]=tables[id][p[0]],name=id==='trig-sine'?'sin':id==='trig-cosine'?'cos':'tan';
            const axis={0:'(1, 0)',90:'(0, 1)',180:'(−1, 0)',270:'(0, −1)'};
            const position=angle%90===0?`${angle}°는 좌표축 위에 있으며 단위원의 점은 ${axis[angle]}입니다.`:
                `${angle}°는 제${angle<90?1:2}사분면에 있으므로 sin은 양수, cos은 ${angle<90?'양수':'음수'}, tan은 ${angle<90?'양수':'음수'}입니다.`;
            let calculation;
            if(angle%90===0) calculation=name==='tan'?`tan ${angle}° = sin ${angle}° / cos ${angle}° = 0/(${angle===0?1:-1}) = 0입니다.`:`${name} ${angle}°는 이 점의 ${name==='sin'?'y':'x'}좌표이므로 ${name} ${angle}° = ${value}입니다.`;
            else if(name==='sin') calculation=`기준각은 ${180-angle<angle?180-angle:angle}°이고 sin 30° = 1/2이므로 sin ${angle}° = 1/2 = 0.5입니다.`;
            else if(name==='cos') calculation=`기준각은 60°이고 cos 60° = 1/2이므로 cos ${angle}° = ${value<0?'−':''}1/2 = ${value}입니다.`;
            else calculation=`기준각은 45°이고 sin 45° = cos 45°이므로 tan 45° = 1입니다. 사분면 부호를 적용하면 tan ${angle}° = ${value}입니다.`;
            return done(['단위원에서 cos은 x좌표, sin은 y좌표이고 tan θ = sin θ / cos θ입니다. 특수각의 크기와 사분면의 부호를 함께 확인합니다.',position,calculation]);
        }
        case 'trig-triangle': {
            const [half]=p,length=2*half;
            return done(['직각삼각형에서 sin θ = 대변/빗변이므로 대변 = 빗변 × sin θ입니다.',
                `예각은 30°이고 sin 30° = 1/2이므로 대변/${length} = 1/2입니다.`,
                `양변에 빗변 ${length}를 곱하면 대변 = ${length} × 1/2 = ${half}입니다.`]);
        }
        case 'arithmetic-nth': case 'arithmetic-sum': case 'arithmetic-recover-d': case 'arithmetic-recover-a': {
            const [a,d,n]=p,last=a+(n-1)*d,sum=n*(a+last)/2;
            if(id==='arithmetic-nth') return done(['등차수열은 항이 하나 증가할 때마다 공차 d를 더합니다. 제n항은 a_n = a₁ + (n−1)d입니다.',
                `첫항에서 제${n}항까지 간격은 ${n} − 1 = ${n-1}개이므로 증가량은 ${n-1} × ${d} = ${(n-1)*d}입니다.`,
                `따라서 제${n}항 = (${a}) + ${(n-1)*d} = ${last}입니다.`]);
            if(id==='arithmetic-sum') return done(['등차수열의 합은 첫항과 마지막 항을 짝지어 S_n = n(a₁+a_n)/2로 구합니다.',
                `마지막 항은 a_${n} = ${a} + (${n} − 1) × ${d} = ${last}입니다.`,
                `따라서 S_${n} = ${n} × (${a} + ${last})/2 = ${n*(a+last)}/2 = ${sum}입니다.`]);
            if(id==='arithmetic-recover-d') return done(['첫항에서 제n항까지는 n−1개의 간격이 있으므로 공차는 두 항의 차를 간격 수로 나눈 값입니다.',
                `간격 수는 ${n} − 1 = ${n-1}, 전체 증가량은 (${last}) − (${a}) = ${last-a}입니다.`,
                `따라서 공차 d = ${last-a}/${n-1} = ${d}입니다.`]);
            return done(['등차수열의 합 공식 S_n = n{2a₁+(n−1)d}/2에서 첫항 a₁을 역으로 구합니다.',
                `주어진 합 ${sum}을 대입하면 ${sum} = ${n}{2a₁ + (${n} − 1) × ${d}}/2입니다.`,
                `양변에 2/${n}을 곱하면 2a₁ + ${(n-1)*d} = (${2*sum})/${n} = ${2*a+(n-1)*d}입니다.`,
                `따라서 2a₁ = (${2*a+(n-1)*d}) − ${(n-1)*d} = ${2*a}, a₁ = (${2*a})/2 = ${a}입니다.`]);
        }
        case 'geometric-nth': case 'geometric-sum': {
            const [a,q,n]=p;
            return done(id==='geometric-nth'?['등비수열은 다음 항으로 갈 때마다 공비 q를 곱하므로 a_n = a₁q^(n−1)입니다.',
                `제${n}항까지 공비 ${q}를 ${n} − 1 = ${n-1}번 곱하므로 ${q}^${n-1} = ${q**(n-1)}입니다.`,
                `따라서 a_${n} = ${a} × ${q**(n-1)} = ${a*q**(n-1)}입니다.`]:
                ['공비가 1이 아닌 등비수열의 합은 S_n = a₁(q^n−1)/(q−1)입니다. qS_n−S_n을 계산하면 중간 항들이 소거됩니다.',
                `공비 ${q} ≠ 1이고 ${q}^${n} = ${q**n}이므로 분자는 ${a} × (${q**n} − 1) = ${a*(q**n-1)}입니다.`,
                `분모는 ${q} − 1 = ${q-1}이므로 S_${n} = ${a*(q**n-1)}/${q-1} = ${a*(q**n-1)/(q-1)}입니다.`]);
        }
        case 'derivative-cubic': {
            const [a,b,c,x]=p;
            return done(['거듭제곱 미분법 (x^n)′ = nx^(n−1)을 각 항에 적용하여 도함수를 구합니다.',
                `f′(x) = ${3*a}x² + (${2*b})x + (${c})입니다.`,
                `x=(${x})를 대입하면 f′(${x}) = ${3*a} × (${x})² + (${2*b}) × (${x}) + (${c})입니다.`,
                `각 항을 계산하여 (${3*a*x*x}) + (${2*b*x}) + (${c}) = ${3*a*x*x+2*b*x+c}입니다.`]);
        }
        case 'derivative-tangent-slope': {
            const [a,b,c,x]=p;
            return done(['접선의 기울기는 접점에서의 미분계수 f′(x)입니다. 상수항의 미분은 0입니다.',
                `f(x)의 각 항을 미분하면 f′(x) = ${2*a}x + (${b})이며 상수 (${c})는 사라집니다.`,
                `x=(${x})에서 f′(${x}) = ${2*a} × (${x}) + (${b}) = (${2*a*x}) + (${b}) = ${2*a*x+b}입니다.`]);
        }
        case 'derivative-stationary': {
            const [a,x,c]=p,b=-2*a*x;
            return done(['먼저 도함수를 구하고 f′(x)=0이라는 방정식을 풉니다.',
                `f′(x) = ${2*a}x + (${b})입니다. 상수항 (${c})의 미분은 0입니다.`,
                `${2*a}x + (${b}) = 0에서 ${2*a}x = ${-b}입니다.`,
                `따라서 x = (${-b})/${2*a} = ${x}입니다.`]);
        }
        case 'derivative-second': {
            const [a,b,c,x]=p;
            return done(['이계도함수는 원래 함수를 두 번 미분한 결과입니다.',
                `한 번 미분하면 f′(x) = ${3*a}x² + (${2*b})x + (${c})입니다.`,
                `다시 미분하면 f″(x) = ${6*a}x + (${2*b})입니다.`,
                `따라서 f″(${x}) = ${6*a} × (${x}) + (${2*b}) = (${6*a*x}) + (${2*b}) = ${6*a*x+2*b}입니다.`]);
        }
        case 'integral-linear': {
            const [lo,gap,a,b]=p,hi=lo+gap,upper=a*hi*hi/2+b*hi,lower=a*lo*lo/2+b*lo;
            return done(['정적분은 원시함수의 위끝 값에서 아래끝 값을 뺍니다. 음수 구간에서도 같은 공식을 적용하며, 결과는 부호 있는 넓이입니다.',
                `원시함수는 F(x) = (${a}/2)x² + (${b})x입니다. 적분상수는 두 끝값의 차에서 소거됩니다.`,
                `위끝에서 F(${hi}) = (${a}/2) × (${hi})² + (${b}) × (${hi}) = ${upper}입니다.`,
                `아래끝에서 F(${lo}) = (${a}/2) × (${lo})² + (${b}) × (${lo}) = ${lower}입니다.`,
                `따라서 정적분 = F(${hi}) − F(${lo}) = (${upper}) − (${lower}) = ${upper-lower}입니다.`]);
        }
        case 'probability-single': {
            const [s,other]=p,total=s+other;
            return fraction(['각 공이 선택될 가능성이 동일하므로 확률은 원하는 경우의 수를 전체 경우의 수로 나눈 값입니다.',
                `전체 공은 ${total}개, 빨간 공은 ${s}개이므로 확률 = ${s}/${total}입니다.`],s,total);
        }
        case 'probability-without-replacement': {
            const [s,other]=p,total=s+other;
            return fraction(['되돌려 놓지 않고 뽑으므로 둘째 확률은 첫째 결과에 따른 조건부확률입니다. 두 사건의 확률을 차례로 곱합니다.',
                `첫째 공이 빨간색일 확률은 ${s}/${total}입니다.`,
                `첫째가 빨간색이면 남은 빨간 공은 ${s} − 1 = ${s-1}개, 전체는 ${total} − 1 = ${total-1}개이므로 둘째 조건부확률은 ${s-1}/${total-1}입니다.`,
                `따라서 둘 다 빨간색일 확률 = ${s}/${total} × ${s-1}/${total-1} = ${s*(s-1)}/${total*(total-1)}입니다.`],s*(s-1),total*(total-1));
        }
        case 'vector-dot': {
            const [a,b,c,d]=p;
            return done(['평면벡터의 내적은 같은 위치에 있는 성분끼리 곱한 값의 합입니다: (a,b)·(c,d) = ac+bd.',
                `첫 성분의 곱은 (${a}) × (${c}) = ${a*c}, 둘째 성분의 곱은 (${b}) × (${d}) = ${b*d}입니다.`,
                `두 곱을 더하면 (${a*c}) + (${b*d}) = ${a*c+b*d}입니다.`]);
        }
        case 'composite-derivative-shift': {
            const [a,b,c,x]=p;
            return done(['g(x)는 도함수 f′(x)에 상수를 더한 함수입니다. f를 먼저 미분하고 g를 계산합니다.',
                `f′(x) = ${2*a}x + (${b})이므로 g(x) = ${2*a}x + (${b}) + (${c})입니다.`,
                `x=(${x})에서 f′(${x}) = ${2*a} × (${x}) + (${b}) = ${2*a*x+b}입니다.`,
                `따라서 g(${x}) = (${2*a*x+b}) + (${c}) = ${2*a*x+b+c}입니다.`]);
        }
        case 'composite-tangent-intercept': {
            const [a,b,c,x]=p,y=a*x*x+b*x+c,m=2*a*x+b;
            return done(['접선의 식은 y−f(t) = f′(t)(x−t)입니다. 접점과 기울기를 구한 뒤 y절편을 계산합니다.',
                `도함수는 f′(x) = ${2*a}x + (${b})이므로 접선의 기울기 m = ${2*a} × (${x}) + (${b}) = ${m}입니다.`,
                `접점의 y좌표는 f(${x}) = ${a} × (${x})² + (${b}) × (${x}) + (${c}) = ${y}입니다.`,
                `접선 y=mx+B에 접점 (${x}, ${y})를 대입하면 B = f(${x}) − m × (${x})입니다.`,
                `따라서 B = (${y}) − (${m}) × (${x}) = (${y}) − (${m*x}) = ${y-m*x}입니다.`]);
        }
        case 'composite-integral-derivative': {
            const [a,b,lo,gap]=p,hi=lo+gap,upper=a*hi*hi+b*hi,lower=a*lo*lo+b*lo;
            return done(['미적분의 기본정리에 의해 f′(x)의 정적분은 원래 함수 f의 위끝 값에서 아래끝 값을 뺀 값입니다.',
                `f′(x) = ${2*a}x + (${b})이며 원시함수로 f(x) = ${a}x² + (${b})x를 사용할 수 있습니다.`,
                `위끝 값 f(${hi}) = ${a} × (${hi})² + (${b}) × (${hi}) = ${upper}입니다.`,
                `아래끝 값 f(${lo}) = ${a} × (${lo})² + (${b}) × (${lo}) = ${lower}입니다.`,
                `따라서 정적분 = f(${hi}) − f(${lo}) = (${upper}) − (${lower}) = ${upper-lower}입니다.`]);
        }
        case 'composite-sequence-function': {
            const [a,d,n,c,b]=p,t=a+(n-1)*d;
            return done(['등차수열의 제n항을 공차로 구한 후, 그 항을 함수의 입력으로 대입합니다.',
                `t = a₁ + (n−1)d = ${a} + (${n} − 1) × ${d} = ${a} + ${(n-1)*d} = ${t}입니다.`,
                `f(t) = ${c}t² + (${b})이므로 t² = (${t})² = ${t*t}을 먼저 계산합니다.`,
                `따라서 f(${t}) = ${c} × ${t*t} + (${b}) = ${c*t*t} + (${b}) = ${c*t*t+b}입니다.`]);
        }
        default: throw new Error(`Missing solution for template: ${id}`);
        }
    }
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
