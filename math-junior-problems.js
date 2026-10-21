/* Pure generators: injected RNG, fixed selected track, no DOM/storage/auth. */
(function(root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.MathJunior = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
 'use strict';
 const tracks = [
  {id:'k-count',label:'유아 1 · 수 세기',topics:['1~10 수 세기'],templates:['count']},
  {id:'k-compare',label:'유아 2 · 비교와 규칙',topics:['많고 적음','반복 규칙'],templates:['compare','pattern']},
  {id:'k-shape',label:'유아 3 · 도형 친구',topics:['동그라미·세모·네모·별'],templates:['shape']},
  {id:'e1',label:'초등 1학년',topics:['덧셈','뺄셈','몇십 몇','도형'],templates:['add','subtract','tens','sides']},
  {id:'e2',label:'초등 2학년',topics:['두 자리 덧셈','곱셈구구','시각','길이'],templates:['add','multiply','clock','length']},
  {id:'e3',label:'초등 3학년',topics:['곱셈','나눗셈','분수의 뜻','길이'],templates:['multiply','divide','fraction','length']},
  {id:'e4',label:'초등 4학년',topics:['큰 수','각도','소수 덧셈','사각형'],templates:['place','angle','decimalAdd','perimeter']},
  {id:'e5',label:'초등 5학년',topics:['분수','넓이','평균','소수 덧셈'],templates:['fraction','area','mean','decimalAdd']},
  {id:'e6',label:'초등 6학년',topics:['비율','원의 넓이','부피','소수 나눗셈'],templates:['ratio','circle','volume','divide']}
 ];
 const shapes=[['●','동그라미',0],['▲','세모',3],['■','네모',4],['★','별',10]];
 const rounded=n=>Math.round(n*1000)/1000;
 function generate(track, index=0, random=Math.random) {
  const meta=tracks.find(t=>t.id===track);
  if(!meta) throw new RangeError('알 수 없는 학습 과정');
  const int=(a,b)=>a+Math.floor(random()*(b-a+1));
  const type=meta.templates[((Math.floor(index)%meta.templates.length)+meta.templates.length)%meta.templates.length];
  let text, answer, topic, steps, visual=null, givens={}, alternatives;
  const set=(t,q,a,g,s)=>{topic=t;text=q;answer=a;givens=g;steps=s;};
  let a,b,n,w,h;
  switch(type) {
   case 'count':
    n=int(1,10); set('수 세기','사과는 모두 몇 개일까요?',n,{n},['사과를 하나씩 짚으며 하나, 둘, 셋 순서로 세어요.',`마지막에 센 수는 ${n}입니다. 사과는 ${n}개예요.`]);
    visual={symbols:Array(n).fill('🍎'),label:'사과를 하나씩 세어 보세요'}; break;
   case 'compare':
    a=int(1,5); b=int(1,4); if(b>=a)b++;
    set('양 비교','어느 쪽에 사과가 더 많을까요?',a>b?'왼쪽':'오른쪽',{a,b},[`왼쪽 사과는 ${a}개, 오른쪽 사과는 ${b}개예요.`,`${Math.max(a,b)}개가 ${Math.min(a,b)}개보다 많아요. ${a>b?'왼쪽':'오른쪽'}이 더 많아요.`]);
    visual={symbols:['왼쪽 '+ '🍎'.repeat(a),'오른쪽 '+ '🍎'.repeat(b)],label:'왼쪽과 오른쪽 사과의 수를 비교하세요'};
    alternatives=['왼쪽','오른쪽','똑같아요','둘 다 없어요'];break;
   case 'pattern': {
    const first=int(0,3), second=(first+int(1,3))%shapes.length;
    const pair=[shapes[first],shapes[second]];
    n=int(4,7);
    const symbols=Array.from({length:n},(_,i)=>pair[i%2][0]);
    const next=pair[n%2], last=pair[(n-1)%2];
    set('반복 규칙','물음표에 올 모양은 무엇일까요?',next[0],{symbols},[`${pair[0][1]} 다음에는 ${pair[1][1]}가 와요. 두 모양이 번갈아 나와요.`,`마지막 ${last[1]} 다음에는 ${next[1]}(${next[0]})가 와요.`]);
    visual={symbols:[...symbols,'?'],label:`${pair[0][1]}와 ${pair[1][1]}가 번갈아 나오는 규칙`};
    alternatives=['●','▲','■','★'];break;
   }
   case 'shape': {
    const s=shapes[int(0,3)];set('도형 이름','이 모양의 이름은 무엇일까요?',s[1],{name:s[1]},[s[1]==='동그라미'?'둥글고 뾰족한 모서리가 없어요.':s[1]==='세모'?'곧은 선 세 개가 이어져 있어요.':s[1]==='네모'?'곧은 선 네 개가 이어져 있어요.':'뾰족한 끝이 다섯 방향으로 뻗어 있어요.',`이 모양은 ${s[1]}예요.`]);
    visual={symbols:[s[0]],label:'이 도형의 이름을 골라 보세요'};alternatives=shapes.map(s=>s[1]);break;
   }
   case 'add':
    a=track==='e1'?int(1,8):int(11,48); b=track==='e1'?int(1,9-a):int(11,48);
    set('덧셈',`${a} + ${b} = ?`,a+b,{items:[a,b]},[`${a}에 ${b}를 더해요.`,track==='e1'?`${a}부터 ${b}번 더 세면 ${a+b}입니다.`:`십의 자리끼리, 일의 자리끼리 더하고 10이 되면 받아올려요. ${a} + ${b} = ${a+b}입니다.`]);break;
   case 'subtract':
    a=int(3,9); b=int(1,a);set('뺄셈',`${a} - ${b} = ?`,a-b,{a,b},[`${a}개에서 ${b}개를 덜어 내요.`,`${a}에서 ${b}만큼 거꾸로 세면 ${a-b}이 남아요.`]);break;
   case 'tens':
    a=int(1,9);b=int(0,9);set('몇십 몇',`10이 ${a}개, 1이 ${b}개인 수는?`,a*10+b,{tens:a,ones:b},[`10이 ${a}개이면 ${a*10}이에요.`,`${a*10} + ${b} = ${a*10+b}입니다.`]);break;
   case 'sides': {
    const s=shapes[int(1,2)];set('도형',`${s[0]} ${s[1]}의 곧은 변은 몇 개일까요?`,s[2],{sides:s[2]},['도형의 둘레를 따라 곧은 선을 하나씩 세어요.',`${s[1]}는 곧은 변이 ${s[2]}개예요.`]);break;
   }
   case 'multiply':
    a=track==='e3'?int(11,29):int(2,9);b=int(2,9);set('곱셈',`${a}개씩 ${b}묶음이면 모두 몇 개일까요?`,a*b,{a,b},[`${a}를 ${b}번 더하는 것을 ${a} × ${b}로 나타내요.`,`${a} × ${b} = ${a*b}이므로 모두 ${a*b}개입니다.`]);break;
   case 'clock':
    a=int(1,12);set('시각',`${a}시에서 30분이 지났어요. 시각은?`,`${a}:30`,{hour:a},['30분은 한 시간의 반이에요.',`${a}시에서 30분 뒤는 ${a}시 30분입니다. 보기의 : 앞은 시, 뒤는 분이에요.`]);alternatives=[`${a}:30`,`${a}:00`,`${a===12?1:a+1}:30`,`${a===1?12:a-1}:30`];break;
   case 'length':
    a=int(1,5);b=int(1,90);set('길이',`${a} m ${b} cm는 몇 cm일까요?`,a*100+b,{m:a,cm:b},['1 m는 100 cm입니다.',`${a} m = ${a*100} cm이므로 ${a*100} + ${b} = ${a*100+b} cm입니다.`]);break;
   case 'divide':
    b=int(2,9);n=int(2,9); a=b*n;
    if(track==='e6'){a/=10;b/=10;}
    set(track==='e6'?'소수 나눗셈':'나눗셈',`${a} ÷ ${b} = ?`,n,{a,b},[track==='e6'?`나누는 수와 나누어지는 수를 모두 10배 하면 ${(a*10).toFixed(0)} ÷ ${(b*10).toFixed(0)}입니다.`:`${b} × □ = ${a}인 수를 찾아요.`,`${b} × ${n} = ${a}이므로 몫은 ${n}입니다.`]);break;
   case 'fraction':
    b=int(2,8);a=track==='e3'?1:int(1,b-1);n=b*int(2,8);
    set('분수의 뜻',`${n}개의 ${a}/${b}은 몇 개일까요?`,n/b*a,{total:n,num:a,den:b},[`${n}개를 똑같이 ${b}묶음으로 나누면 한 묶음은 ${n} ÷ ${b} = ${n/b}개예요.`,`그중 ${a}묶음은 ${n/b} × ${a} = ${n/b*a}개입니다.`]);break;
   case 'place':
    n=int(10000,99999);a=int(0,3);b=10**(4-a);set('큰 수',`${n}에서 왼쪽 ${a+1}번째 숫자가 나타내는 값은?`,Number(String(n)[a])*b,{n,position:a},[`왼쪽 ${a+1}번째 자리는 ${b}의 자리입니다.`,`그 숫자는 ${String(n)[a]}이므로 ${String(n)[a]} × ${b} = ${Number(String(n)[a])*b}입니다.`]);break;
   case 'angle':
    a=int(2,16)*10;set('각도',`일직선 위의 두 이웃한 각의 합은 180°입니다. 한 각이 ${a}°이면 다른 각은 몇 도?`,180-a,{a},['일직선을 이루는 두 각의 합은 180°입니다.',`180 - ${a} = ${180-a}이므로 다른 각은 ${180-a}°입니다.`]);break;
   case 'decimalAdd':
    a=int(1,89);b=int(1,89);set('소수 덧셈',`${a/10} + ${b/10} = ?`,rounded((a+b)/10),{a,b},[`0.1이 ${a}개와 ${b}개이므로 합하면 0.1이 ${a+b}개입니다.`,`소수점끼리 맞추어 더하면 ${a/10} + ${b/10} = ${rounded((a+b)/10)}입니다.`]);break;
   case 'perimeter': case 'area':
    w=int(2,15);h=int(2,15);set(type==='area'?'직사각형 넓이':'직사각형 둘레',`가로 ${w} cm, 세로 ${h} cm인 직사각형의 ${type==='area'?'넓이는 몇 cm²':'둘레는 몇 cm'}일까요?`,type==='area'?w*h:2*(w+h),{w,h},[type==='area'?'넓이 = 가로 × 세로입니다.':'둘레 = 가로 + 세로 + 가로 + 세로입니다.',type==='area'?`${w} × ${h} = ${w*h}이므로 넓이는 ${w*h} cm²입니다.`:`(${w} + ${h}) × 2 = ${2*(w+h)}이므로 둘레는 ${2*(w+h)} cm입니다.`]);break;
   case 'mean':
    a=int(4,20);b=int(1,3);set('평균',`${a-b}, ${a}, ${a+b}의 평균은?`,a,{items:[a-b,a,a+b]},[`자료의 합은 ${a-b} + ${a} + ${a+b} = ${a*3}입니다.`,`자료가 3개이므로 평균은 ${a*3} ÷ 3 = ${a}입니다.`]);break;
   case 'ratio':
    a=int(1,9)*10;b=int(1,9)*10;set('백분율',`${a}명의 ${b}%는 몇 명일까요?`,a*b/100,{whole:a,percent:b},[`${b}%는 100을 기준으로 ${b}, 즉 ${b}/100입니다.`,`전체 × 비율 = ${a} × ${b}/100 = ${a*b/100}명이에요.`]);break;
   case 'circle':
    a=int(2,10);set('원의 넓이',`반지름 ${a} cm인 원의 넓이는 몇 cm²? (원주율 3.14)`,rounded(a*a*3.14),{r:a},['원의 넓이 = 반지름 × 반지름 × 원주율입니다.',`${a} × ${a} × 3.14 = ${rounded(a*a*3.14)}이므로 ${rounded(a*a*3.14)} cm²입니다.`]);break;
   case 'volume':
    w=int(2,9);h=int(2,9);a=int(2,9);set('직육면체 부피',`가로 ${w} cm, 세로 ${h} cm, 높이 ${a} cm인 직육면체의 부피는 몇 cm³?`,w*h*a,{w,h,d:a},[`밑면의 넓이는 ${w} × ${h} = ${w*h} cm²입니다.`,`밑넓이 × 높이 = ${w*h} × ${a} = ${w*h*a} cm³입니다.`]);break;
  }
  const choices=alternatives?alternatives.slice():[String(answer)];
  if(!alternatives){
   // Mix smaller/larger plausible values: the answer must not always be the minimum.
   // Keep distractors on the topic's scale, even when a decimal sum is an integer.
   const topicSteps={place:b,angle:10,decimalAdd:0.1,perimeter:2,circle:3.14};
   const step=topicSteps[type]??(Number.isInteger(answer)?1:0.1);
   const minChoice=type==='place'&&answer!==0?b:type==='angle'?10:0;
   const maxChoice=type==='place'?9*b:type==='angle'?170:Infinity;
   const offsets=[-step,step,-2*step,2*step,-3*step,3*step];
   for(let i=offsets.length-1;i>0;i--){const j=int(0,i);[offsets[i],offsets[j]]=[offsets[j],offsets[i]];}
   for(const offset of offsets){const value=rounded(Number(answer)+offset);if(value>=minChoice&&value<=maxChoice&&!choices.includes(String(value)))choices.push(String(value));if(choices.length===4)break;}
   let offset=1;while(choices.length<4){const value=String(rounded(Number(answer)+offset++));if(!choices.includes(value))choices.push(value);}
  }
  for(let i=choices.length-1;i>0;i--){const j=int(0,i);[choices[i],choices[j]]=[choices[j],choices[i]];}
  return {track,template:type,topic,text,answer,choices,solutionSteps:steps,visual,givens};
 }
 return {tracks,generate};
});
