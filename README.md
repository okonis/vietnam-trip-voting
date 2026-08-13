# Vietnam Trip Voting

Współdzielona apka do głosowania nad 14-dniową wycieczką do Wietnamu.

## Funkcje
- interaktywne karty ze zdjęciami i opisami,
- filtry: Miasta / Natura / Sport,
- głosy 🔥 / 👍 / 🤷 / ❌,
- komentarze każdej osoby,
- ranking grupy,
- mapa Leaflet / OpenStreetMap,
- prosta sugestia trasy z limitem 14 dni,
- tryb demo offline (localStorage),
- tryb współdzielony po podłączeniu Supabase.

## 1. Uruchom lokalnie
Najprościej:
```bash
python -m http.server 8000
```
Potem otwórz `http://localhost:8000`.

## 2. Wspólne głosowanie — Supabase
1. Załóż darmowy projekt w Supabase.
2. Otwórz SQL Editor i wykonaj zawartość `supabase.sql`.
3. W Project Settings -> API skopiuj:
   - Project URL
   - anon/public key
4. Wklej je do `config.js`.

Po tym wszyscy korzystający z tego samego linku będą widzieć wspólne głosy i komentarze.

## 3. Udostępnienie
### GitHub Pages
Wrzuć pliki do publicznego repozytorium, następnie:
Settings -> Pages -> Deploy from a branch -> main / root.

### Vercel / Netlify
Możesz przeciągnąć cały folder albo podłączyć repozytorium. To aplikacja statyczna — nie wymaga builda.

## Ważne
Anonimowe RLS w `supabase.sql` celowo pozwala każdemu użytkownikowi linku dodawać głosy i komentarze.
To jest dobre dla prywatnej ankiety wśród znajomych, ale nie jest systemem logowania ani zabezpieczeniem przed spamem.
