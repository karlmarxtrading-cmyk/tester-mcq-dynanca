# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "Dynanca" [ref=e4] [cursor=pointer]:
        - /url: ../
        - img "Dynanca" [ref=e6]
      - navigation "Choose display theme" [ref=e8]:
        - button "Light" [ref=e9] [cursor=pointer]
        - button "Dark" [ref=e10] [cursor=pointer]
        - button "System" [pressed] [ref=e11] [cursor=pointer]
  - main [ref=e12]:
    - generic [ref=e13]:
      - paragraph [ref=e14]:
        - link "← Practice catalog" [ref=e15] [cursor=pointer]:
          - /url: ../#catalog
      - paragraph [ref=e16]: DYNANCA
      - heading "Practice could not be loaded" [level=1] [ref=e17]
      - paragraph [ref=e18]: The practice catalog could not be reached.
      - paragraph
      - paragraph [ref=e19]
    - region "Practice session" [ref=e20]:
      - alert [ref=e22]:
        - strong [ref=e23]: Practice could not be loaded.
        - paragraph [ref=e24]: The connection may be slow or interrupted. Check your internet connection, then try again.
        - generic [ref=e25]:
          - button "Try again" [ref=e26] [cursor=pointer]
          - link "Back to the catalog" [ref=e27] [cursor=pointer]:
            - /url: ../#catalog
  - contentinfo [ref=e28]:
    - paragraph [ref=e29]: Part of the Dynanca learning ecosystem.
```