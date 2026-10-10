# apex-cli — contrôle d’adoption · adoption check · comprobación de adopción

## Français

Point de départ local, après la préparation indiquée dans le README :

```sh
npm run build
APEX_BASE_URL=not-a-url node dist/index.js doctor
```

Préparez une configuration avec une URL de base invalide et lancez le diagnostic avant toute recherche. Le diagnostic doit signaler le problème sans afficher la clé ni appeler l’API. Un code de sortie non nul est attendu pour cette URL invalide.

## English

Local starting point, after the setup described in the README:

```sh
npm run build
APEX_BASE_URL=not-a-url node dist/index.js doctor
```

Try an invalid base URL and run the doctor before searching. It should report the problem without printing the key or calling the API. A nonzero exit code is expected for this invalid URL.

## Español

Punto de partida local, después de la preparación descrita en el README:

```sh
npm run build
APEX_BASE_URL=not-a-url node dist/index.js doctor
```

Pruebe una URL base no válida y ejecute el diagnóstico antes de buscar. Debe indicar el problema sin mostrar la clave ni llamar a la API. Se espera un código de salida distinto de cero para esta URL inválida.
## Variante synthétique · Synthetic variation · Variante sintética

```text
APEX_BASE_URL=not-a-url
```

FR : adaptez une copie de la fixture locale à cette situation, puis vérifiez le comportement décrit ci-dessus. Les valeurs sont illustratives, pas des résultats Jev mesurés.

EN: adapt a copy of the local fixture to this situation, then check the behavior described above. Values are illustrative, not measured Jev output.

ES: adapte una copia de la fixture local a esta situación y compruebe el comportamiento descrito arriba. Los valores son ilustrativos, no resultados Jev medidos.

## Second cas · Second case · Segundo caso

```text
APEX_BASE_URL=https://api.example.invalid; APEX_API_KEY=unset
```

**FR :** Avec une URL syntaxiquement valide mais sans clé, `doctor` doit signaler la clé absente sans tenter de recherche ni révéler une valeur sensible.

**EN:** With a syntactically valid URL but no key, `doctor` should report the missing key without searching or revealing a sensitive value.

**ES:** Con una URL sintácticamente válida pero sin clave, `doctor` debe informar de la clave ausente sin buscar ni revelar un valor sensible.
