# Vietnam Trip Voting v2

Rozbudowana wersja aplikacji do wspólnego planowania 14-dniowej podróży do Wietnamu.

## Co nowego w v2
- 25 miejsc i aktywności zamiast podstawowej listy,
- bogatsze opisy i tagi,
- sekcje:
  - Specjalności Wietnamu,
  - Czego spróbować,
  - Unikatowe doświadczenia,
  - Styczeń 2027 / klimat przed Tết,
- mapa wszystkich punktów,
- głosowanie i komentarze,
- ranking grupy,
- sugestia trasy z limitem 14 dni.

## Publikacja
W repozytorium GitHub Pages podmień:
- `index.html`
- `app.js`
- `styles.css`
- `places.json`

GitHub Pages powinien przebudować stronę automatycznie po commicie.

## Wspólne głosowanie
Jeśli `config.js` nie zawiera danych Supabase, aplikacja działa w trybie demo i zapisuje głosy lokalnie w przeglądarce.
Aby wszyscy widzieli wspólne wyniki, podłącz Supabase zgodnie z `supabase.sql`.
