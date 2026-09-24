# aaaa

Vercel 배포 URL: https://aaaa-phi-lovat.vercel.app/

## 페이지

- 자기소개/메뉴: `/index.html`
- 오목 게임: `/omok.html`
- 윷놀이: `/yut.html`

## 맥미니 온라인 오목 서버

다른 폰끼리 오목을 두려면 맥미니 Node 서버 주소로 접속합니다.

```bash
cd /Users/chojiks/github-aaaa
PORT=8792 HOST=0.0.0.0 node omok-server.js
```

같은 와이파이에서는:

```text
http://192.168.45.156:8792/omok.html
```

사용 순서:

1. 첫 번째 폰에서 `대결 방식 → 온라인 방 대결`
2. `온라인 방 만들기`
3. 표시된 방 코드를 확인
4. 다른 폰에서 같은 주소 접속
5. `대결 방식 → 온라인 방 대결`
6. 방 코드 입력 후 `방 입장`
7. 흑/백 각자 자기 차례에 착수

## 맥미니 온라인 윷놀이 서버

다른 폰들이 같은 방에 접속해 윷놀이를 하려면 정적 Vercel 주소가 아니라 맥미니 Node 서버 주소로 접속합니다.

```bash
cd /Users/chojiks/github-aaaa
PORT=8791 HOST=0.0.0.0 node yut-server.js
```

같은 와이파이에서는:

```text
http://192.168.45.156:8791/yut.html
```

사용 순서:

1. 첫 번째 폰에서 `온라인 방 만들기`
2. 표시된 방 코드를 확인
3. 다른 폰에서 같은 주소 접속
4. 방 코드 입력 후 `방 입장`
5. 각자 자기 색상 차례에 윷 던지기/말 이동

참고: `https://aaaa-phi-lovat.vercel.app/omok.html`, `https://aaaa-phi-lovat.vercel.app/yut.html`는 정적 배포 페이지라서 맥미니 로컬 서버 API와 직접 연결되지 않습니다. 온라인 방 대국은 위 맥미니 서버 주소로 접속해야 합니다.
