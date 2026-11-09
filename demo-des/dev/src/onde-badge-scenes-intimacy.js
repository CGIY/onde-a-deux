(function (scope) {
  'use strict';

  // Original figurative scenes. Coordinates are deliberately kept inside the
  // shared medal's safe area; the renderer supplies colour and line treatment.
  const closePortraits = new Set(['duo-kiss-language-3', 'duo-kiss-neck-3', 'duo-spoon-3', 'duo-photo-monochrome-3']);
  const scene = (id, motif, shape, tone, draw) => Object.freeze({ id, motif, shape, tone,
    draw: D => closePortraits.has(id)
      ? D.group(draw(D), 'translate(80 83) scale(1.08) translate(-80 -83)') : draw(D)
  });
  const cloth = (D, d, w) => D.path(d, { fill: D.paper, ...(w ? { w } : {}) });
  const head = (D, x, y, s, facing = 'right', hair = 'short', tilt = 0) => {
    if (s >= .55) return D.head(x, y, s, { facing, hair, tilt });
    // A video-call thumbnail needs fewer lines and a finer stroke than a
    // foreground face. Keep the same profile, without microscopic hair detail.
    const long = hair === 'long', w = 1.3 / s;
    const silhouette = long
      ? 'M-13 22 Q-21 8-17-9 Q-14-23 1-22 Q14-20 13-9 L13-4 L17 2 L13 5 Q14 12 3 16 L3 24'
      : 'M-11 20 L-9 11 Q-18 6-17-6 Q-17-21 0-21 Q14-21 13-8 L13-4 L17 2 L13 5 Q14 12 3 15 L3 24';
    const hairline = long ? 'M1-21 Q1-9-10-4 Q-13 5-6 9' : 'M-16-6 Q-9-15-1-12 Q8-10 14-15 M-10-5 Q-3-7-5 1';
    return D.group(D.path(silhouette, { fill: D.paper, w }) + D.path(hairline, { w }) + D.path('M5-1 L8 0', { w }),
      `translate(${x} ${y}) rotate(${tilt}) scale(${facing === 'left' ? -s : s} ${s})`);
  };
  const kissHead = (D, x, y, s, facing, hair) => head(D, x, y, s, facing, hair) +
    D.group(D.path('M12 3 L13 4 Q18 4 19 7 Q16 10 9 11', { fill: D.paper, w: 2.4 / s }),
      `translate(${x} ${y}) scale(${facing === 'left' ? -s : s} ${s})`);

  const scenes = [
    scene('duo-kiss-language-3', 'two-profiles-one-kiss', 'circle', 'peach', D =>
      cloth(D, 'M52 83 C43 88 35 98 33 119 Q43 127 66 129 L80 112 C76 98 70 90 65 87') +
      cloth(D, 'M110 85 C120 92 125 105 128 120 Q109 130 85 129 L75 117 C83 104 87 94 95 87') +
      D.path('M52 84 L62 94 L65 88 M95 88 Q101 95 110 88') +
      kissHead(D, 62.14, 64, .94, 'right', 'short') +
      kissHead(D, 97.86, 64, .94, 'left', 'long')),

    scene('duo-kiss-neck-3', 'a-kiss-at-the-neck', 'shield', 'ivory', D =>
      cloth(D, 'M85 82 C101 82 119 94 125 119 Q112 128 89 129 L68 118 Q74 92 85 82') +
      cloth(D, 'M62 93 C46 96 36 106 33 121 L80 129 Q91 111 79 96') +
      D.path('M86 85 Q99 91 109 89 M61 95 L71 103 L78 97') +
      head(D, 94, 57, .93, 'right', 'long', -14) +
      head(D, 74, 75, .88, 'right', 'short', -8) +
      cloth(D, 'M48 109 Q63 105 77 93 Q80 90 83 91 Q85 92 82 95 L77 99 Q83 94 86 96 Q88 98 84 101 L77 107 Q68 118 52 121') +
      D.path('M76 102 L82 98')),

    scene('duo-oral-car-3', 'two-in-the-parked-car', 'hex', 'sage', D =>
      D.path('M30 68 Q35 38 59 35 L102 35 Q124 38 130 68 M31 70 L129 70 M40 48 L36 64 M119 48 L124 64', { w: 2 }) +
      D.rect(37, 85, 36, 40, 9, D.paper) + D.rect(89, 85, 34, 40, 9, D.paper) +
      cloth(D, 'M48 86 Q37 94 38 119 L77 119 Q75 97 64 87') +
      cloth(D, 'M100 87 Q87 97 87 119 L124 119 Q124 94 111 87') +
      head(D, 58, 69, .68, 'right', 'short') +
      head(D, 103, 69, .68, 'left', 'long') +
      D.path('M49 87 L57 94 L63 88 M99 88 Q105 94 112 88') +
      D.ellipse(55, 110, 15, 10, D.paper) + D.path('M42 107 Q50 103 55 110 L65 116') +
      cloth(D, 'M93 102 Q86 104 78 99 Q74 97 72 100 Q71 103 76 105 Q85 113 96 111') +
      D.path('M75 103 L80 105 M32 125 L128 125')),

    scene('duo-oral-shower-3', 'a-moment-beneath-the-shower', 'oval', 'peach', D =>
      D.path('M119 122 L119 43 Q119 32 108 32 Q98 32 98 41', { w: 2 }) +
      cloth(D, 'M88 47 Q89 37 99 37 Q110 37 111 47 Z', 2) +
      D.path('M91 53 L90 57 M100 54 L100 59 M108 53 L109 57', { w: 1.8 }) +
      cloth(D, 'M48 85 Q35 93 34 119 Q47 127 68 129 L82 117 Q75 93 62 87') +
      cloth(D, 'M95 92 Q110 96 117 119 Q102 129 83 129 L71 112 Q84 95 95 92') +
      head(D, 59, 66, .83, 'right', 'short', 3) +
      head(D, 88, 76, .79, 'left', 'long', 4) +
      D.path('M48 87 L69 116 M62 88 L57 98 M95 94 L78 116 M35 116 Q63 123 76 120 M85 123 L111 117') +
      cloth(D, 'M78 109 Q70 103 66 98 Q63 95 61 97 Q59 99 63 104 L72 116')),

    scene('duo-oral-desk-3', 'across-the-shared-desk', 'shield', 'ivory', D =>
      D.path('M43 37 L65 37 M43 43 L58 43', { w: 1.8 }) +
      cloth(D, 'M43 78 Q34 84 33 105 L73 105 Q73 83 60 78') +
      cloth(D, 'M102 78 Q87 83 87 105 L126 105 Q124 83 115 78') +
      head(D, 54, 59, .72, 'right', 'short') +
      head(D, 105, 59, .72, 'left', 'long') +
      D.path('M44 78 L52 88 L59 79 M100 79 Q108 85 114 79') +
      cloth(D, 'M40 96 Q57 100 73 92 L80 94 Q83 96 79 99 L73 100 Q55 111 40 105') +
      cloth(D, 'M119 96 Q102 98 89 93 Q85 91 82 93 L77 96 Q74 99 79 100 L87 100 Q105 109 119 105') +
      D.path('M29 110 L131 110 M37 110 L37 129 M124 110 L124 129', { w: 2.2 }) +
      D.rect(90, 106, 30, 4, 1, D.paper) + D.path('M94 103 L118 103', { w: 1.6 })),

    scene('duo-sit-face-3', 'company-in-the-armchair', 'rosette', 'rose', D =>
      D.rect(38, 50, 83, 64, 18, D.paper) +
      cloth(D, 'M49 85 Q40 90 40 107 L76 113 Q84 95 66 85') +
      cloth(D, 'M95 86 Q83 96 87 112 L121 109 Q121 92 109 85') +
      head(D, 60, 66, .76, 'right', 'short', -3) +
      head(D, 102, 66, .76, 'left', 'long', 2) +
      D.path('M49 86 L58 95 L65 87 M96 87 Q104 94 110 87') +
      cloth(D, 'M49 102 Q65 105 86 101 Q91 100 93 103 Q94 106 89 107 L76 109 Q62 115 50 112') +
      D.path('M45 115 Q56 111 69 117 L73 129 M89 116 Q107 112 117 118 L119 129') +
      D.path('M33 98 Q31 95 30 99 L30 118 Q30 124 38 124 L123 124 Q131 124 131 117 L131 99 Q130 95 127 98 M40 125 L39 130 M121 125 L122 130')),

    scene('duo-veranda-3', 'together-under-the-glass-roof', 'rosette', 'sage', D =>
      D.path('M31 100 L31 63 Q31 32 80 31 Q129 32 129 63 L129 100 M32 64 L128 64 M80 32 L80 56 M53 38 L53 72 M107 38 L107 76 M42 46 L60 60 M118 46 L100 60', { w: 1.7 }) +
      D.path('M34 112 L111 112 M40 113 L40 128 M108 113 L108 128', { w: 2 }) +
      cloth(D, 'M51 87 Q40 95 39 111 L77 116 Q79 97 65 88') +
      cloth(D, 'M91 90 Q106 94 111 111 L78 121 Q71 101 84 91') +
      head(D, 61, 72, .7, 'right', 'short', 3) +
      head(D, 87, 75, .7, 'left', 'long', -3) +
      D.path('M51 88 L59 97 L65 90 M87 92 L92 100 L99 94') +
      cloth(D, 'M45 104 Q62 106 78 116 Q81 118 78 120 L71 120 Q57 114 45 114') +
      D.path('M95 104 Q90 116 80 121 M50 119 L61 129 M95 120 L91 130') +
      D.plant(121, 123, .58)),

    scene('duo-andromaque-reverse-3', 'turning-back-to-you', 'hex', 'ivory', D =>
      cloth(D, 'M47 80 Q35 87 34 118 L73 127 Q81 97 64 81') +
      cloth(D, 'M93 82 Q109 83 119 96 L126 121 Q110 129 88 127 L79 109 Q84 88 93 82') +
      head(D, 57, 61, .78, 'right', 'short') +
      head(D, 101, 61, .82, 'left', 'long', 10) +
      D.path('M47 81 L55 91 L63 83 M97 83 Q109 90 113 101 Q108 111 92 116 M95 118 L116 124') +
      cloth(D, 'M43 100 Q59 107 75 96 L85 89 Q89 87 91 90 Q92 93 87 96 Q66 119 46 112') +
      D.path('M113 101 Q121 108 116 115 L108 118 M39 120 L57 126')),

    scene('duo-spoon-3', 'two-pyjamas-one-blanket', 'circle', 'sage', D =>
      D.path('M32 55 Q54 51 76 57 M108 58 Q119 55 129 59', { w: 1.8 }) +
      cloth(D, 'M57 78 Q41 77 32 99 L78 114 Q93 98 76 82') +
      cloth(D, 'M91 101 Q102 96 113 109 L119 125 L74 121 Q76 107 91 101') +
      head(D, 67, 59, .84, 'right', 'short', 8) +
      head(D, 99, 81, .78, 'right', 'long', 18) +
      D.path('M55 80 L63 90 L73 84 M91 102 Q98 110 107 110') +
      cloth(D, 'M106 115 Q112 104 117 101 Q119 100 120 102 L118 107 Q123 103 125 106 Q126 109 122 113 L116 122') +
      cloth(D, 'M31 102 Q59 98 85 112 Q106 119 129 127 Q82 133 35 125 Z') +
      D.path('M43 115 Q66 112 85 123', { w: 1.7 })),

    scene('duo-free-position-3', 'the-pose-is-yours', 'shield', 'peach', D =>
      cloth(D, 'M40 88 Q31 96 31 117 L70 125 Q75 103 56 89') +
      cloth(D, 'M96 81 Q84 86 83 109 L89 128 L124 128 L124 104 Q122 88 110 82') +
      head(D, 49, 70, .73, 'right', 'short') +
      head(D, 104, 61, .78, 'left', 'long', -5) +
      D.path('M40 89 L47 98 L54 91 M95 83 L103 94 L111 84 M87 108 Q103 113 121 107') +
      cloth(D, 'M112 91 Q120 82 119 72 L115 59 Q114 55 117 55 Q120 56 122 62 L127 75 Q130 90 119 101') +
      cloth(D, 'M36 106 Q49 112 65 109 L72 104 Q75 102 77 105 Q79 108 73 112 Q55 123 38 116') +
      cloth(D, 'M61 96 L79 99 L75 119 L57 115 Z', 1.8) +
      D.path('M66 101 L73 103 M64 106 L71 108 M75 92 L80 86', { w: 1.7 })),

    scene('duo-lovense-quarter-3', 'a-quarter-hour-for-two', 'circle', 'ivory', D =>
      D.circle(80, 40, 9) + D.path('M80 33 L80 40 L86 40 M82 32 Q87 33 88 38', { w: 1.7 }) +
      D.path('M34 95 Q31 86 40 85 M119 85 Q129 85 127 96 M32 121 L129 121', { w: 1.9 }) +
      cloth(D, 'M44 85 Q33 93 34 115 L75 118 Q77 97 61 86') +
      cloth(D, 'M98 84 Q87 90 86 117 L127 116 Q126 91 113 84') +
      head(D, 54, 66, .76, 'right', 'short') +
      head(D, 104, 65, .76, 'left', 'long') +
      D.path('M45 86 L53 95 L60 88 M99 86 Q107 92 113 86') +
      cloth(D, 'M40 103 Q59 111 73 103 Q77 100 80 102 Q83 106 77 108 Q60 122 42 114') +
      D.rect(75, 99, 12, 19, 3, D.paper) +
      cloth(D, 'M117 102 Q102 105 91 107 L86 106 Q82 107 85 111 L91 113 Q107 116 118 112') +
      D.path('M80 113 L82 113', { w: 1.6 })),

    scene('duo-lovense-evening-3', 'the-evening-belongs-to-two', 'oval', 'rose', D =>
      D.path('M115 33 Q106 35 108 44 Q110 52 120 50 Q110 46 115 33 Z', { w: 1.8 }) +
      D.rect(35, 84, 90, 39, 12, D.paper) +
      cloth(D, 'M46 89 Q38 95 37 114 L80 121 Q83 99 65 89') +
      cloth(D, 'M93 91 Q107 93 116 112 L84 123 Q74 102 86 92') +
      head(D, 58, 70, .78, 'right', 'short', 3) +
      head(D, 88, 72, .76, 'left', 'long', -3) +
      D.path('M47 90 L57 99 L64 91 M90 93 Q98 99 104 96') +
      cloth(D, 'M44 106 Q66 108 83 116 L92 115 Q97 116 93 120 L82 122 Q62 118 45 117') +
      D.path('M102 105 Q105 113 95 117 M40 125 L41 130 M120 125 L119 130') +
      D.rect(112, 111, 9, 15, 2, D.paper) + D.path('M117 126 Q117 131 110 131', { w: 1.6 })),

    scene('duo-photo-monochrome-3', 'a-portrait-and-a-smile', 'shield', 'ivory', D =>
      cloth(D, 'M41 84 Q30 92 30 118 Q47 129 69 129 L76 107 Q65 88 58 84') +
      cloth(D, 'M101 84 Q115 85 127 108 L131 120 Q111 130 83 128 Q86 99 101 84') +
      head(D, 51, 64, .85, 'right', 'short') +
      head(D, 106, 63, .84, 'left', 'long', -5) +
      D.path('M41 85 L52 96 L58 86 M99 87 L104 97 L113 87') +
      cloth(D, 'M47 111 Q60 100 64 80 L65 70 Q65 67 68 68 Q71 69 70 74 L70 82 Q70 107 57 120') +
      D.camera(76, 66, .59) +
      D.path('M78 72 Q81 75 79 79 L74 83 M117 106 Q109 112 107 126')),

    scene('duo-photo-shadows-3', 'two-profiles-in-the-lamplight', 'hex', 'peach', D =>
      D.path('M125 35 L125 122 M109 35 L107 42', { w: 1.9 }) +
      cloth(D, 'M98 49 Q101 39 108 39 Q116 40 119 51 Z', 1.9) +
      D.path('M96 58 L75 92 M119 59 L128 89', { w: 1.2, opacity: .45 }) +
      cloth(D, 'M46 94 Q36 99 30 119 Q49 129 73 128 L81 111 Q68 97 61 94') +
      cloth(D, 'M98 101 Q114 102 124 119 Q111 130 85 129 L78 118 Q86 108 98 101') +
      head(D, 55, 74, .86, 'right', 'short') +
      head(D, 105, 81, .85, 'left', 'long') +
      D.path('M45 95 L54 106 L61 97 M97 104 Q104 111 112 106')),

    scene('duo-photo-shower-3', 'a-fingertip-on-the-misty-mirror', 'circle', 'ivory', D =>
      cloth(D, 'M84 124 L84 60 Q84 36 105 36 Q127 36 127 60 L127 124 Z', 2) +
      cloth(D, 'M99 93 Q91 97 89 122 L124 122 Q121 98 112 94', 1.8) +
      head(D, 108, 75, .7, 'left', 'long') +
      D.path('M101 96 L106 103 L112 96 M92 115 L96 98', { w: 1.7 }) +
      D.path('M65 39 Q61 43 65 47 Q68 51 64 55 M73 36 Q69 40 73 44 Q76 48 72 52', { w: 1.7 }) +
      cloth(D, 'M43 91 Q32 100 31 121 Q49 130 74 129 L79 111 Q66 96 60 91') +
      head(D, 53, 71, .83, 'right', 'long') +
      D.path('M43 93 L53 104 L60 94') +
      cloth(D, 'M57 116 Q67 106 70 96 L76 84 Q78 80 80 82 Q82 84 79 89 L77 94 Q80 91 82 94 Q83 96 79 101 L74 110 L68 124')),

    scene('duo-hc-golden-3', 'two-beneath-one-umbrella', 'circle', 'peach', D =>
      cloth(D, 'M31 58 Q39 35 80 32 Q120 34 129 58 Q116 49 104 58 Q92 50 80 58 Q68 50 56 58 Q43 50 31 58 Z', 2) +
      D.path('M80 32 Q62 41 56 58 M80 32 Q98 41 104 58 M80 59 L80 112 Q80 119 87 117', { w: 1.8 }) +
      cloth(D, 'M48 95 Q37 102 35 121 Q54 129 75 128 L79 113 Q68 98 61 94') +
      cloth(D, 'M97 95 Q113 96 125 119 Q110 128 88 128 L81 112 Q88 99 97 95') +
      head(D, 57, 78, .69, 'right', 'short') +
      head(D, 105, 78, .69, 'left', 'long') +
      D.path('M48 96 L55 106 L61 96 M98 96 L105 106 L112 97 M55 106 L55 122 M105 107 L105 123') +
      cloth(D, 'M43 114 Q60 112 74 104 Q77 102 80 104 L84 104 Q88 105 84 108 L78 109 Q62 121 45 123') +
      D.path('M31 73 L30 77 M129 72 L130 76', { w: 1.6 })),

    scene('duo-hc-chapel-3', 'a-quiet-embrace-under-the-arch', 'shield', 'ivory', D =>
      D.path('M32 122 L32 69 Q38 45 80 31 Q122 45 128 69 L128 122 M43 99 L43 72 Q49 54 80 43 Q111 54 117 72 L117 99 M80 43 L80 58', { w: 1.8 }) +
      cloth(D, 'M51 91 Q40 99 39 120 L77 129 Q83 105 65 92') +
      cloth(D, 'M95 94 Q111 96 122 121 L86 129 Q77 106 87 95') +
      head(D, 61, 74, .71, 'right', 'short', -2) +
      head(D, 97, 77, .71, 'left', 'long', 2) +
      D.path('M52 92 L60 102 L65 94 M94 96 Q103 102 110 98') +
      cloth(D, 'M47 111 Q62 112 77 104 Q81 102 84 105 Q86 108 81 110 Q64 121 48 122') +
      D.path('M111 110 Q99 114 84 108 M54 126 L59 130 M107 126 L103 130')),

    scene('duo-hc-manual-camera-3', 'setting-the-portrait-by-hand', 'hex', 'sage', D =>
      cloth(D, 'M40 88 Q31 99 32 118 L66 126 Q72 105 54 88') +
      cloth(D, 'M103 85 Q116 88 126 108 L129 124 L88 127 Q87 102 103 85') +
      head(D, 49, 70, .73, 'right', 'short', 2) +
      head(D, 110, 66, .77, 'left', 'long', -4) +
      D.path('M41 89 L47 98 L54 91 M101 89 Q109 95 116 89') +
      D.path('M74 83 L74 125 M70 86 L59 126 M78 86 L89 126', { w: 1.8 }) +
      cloth(D, 'M40 109 Q52 103 60 88 L64 76 Q65 72 68 73 Q71 74 69 78 L67 88 Q61 112 49 120') +
      D.camera(75, 75, .6) +
      D.path('M73 66 Q75 62 78 63 Q81 64 80 68 M118 104 Q109 112 108 125', { w: 1.9 })),

    scene('duo-hc-video-finale-3', 'one-last-wave-on-the-call', 'rosette', 'rose', D =>
      cloth(D, 'M41 86 Q30 94 30 119 Q48 128 73 128 L82 109 Q66 89 58 86') +
      head(D, 52, 66, .83, 'right', 'short') +
      D.path('M42 87 L51 98 L59 88') +
      cloth(D, 'M51 113 Q65 101 71 87 L73 70 L72 61 Q72 57 75 58 L78 68 L79 58 Q80 55 82 58 L82 68 L86 61 Q89 59 89 63 L85 76 L82 92 Q74 117 62 124') +
      D.rect(88, 68, 40, 35, 3, D.paper) +
      cloth(D, 'M101 91 Q95 95 95 101 L122 101 Q122 95 114 91', 1.6) +
      head(D, 109, 81, .44, 'left', 'long') +
      D.path('M88 103 L128 103 L131 110 L83 110 Z M36 122 L127 122', { w: 1.8 })),

    scene('duo-hc-upper-frame-3', 'a-wave-in-the-video-window', 'shield', 'peach', D =>
      D.rect(32, 34, 96, 94, 8) +
      cloth(D, 'M65 92 Q48 101 44 123 L115 123 Q110 102 83 94') +
      D.path('M65 93 L75 105 L83 96') +
      head(D, 75, 72, .94, 'right', 'long') +
      cloth(D, 'M93 112 Q106 104 108 89 L108 77 L106 66 Q105 62 108 62 L112 71 L112 60 Q113 56 115 60 L115 70 L119 62 Q122 61 121 65 L118 79 L118 95 Q115 114 105 121') +
      D.rect(38, 41, 24, 29, 3, D.paper) +
      cloth(D, 'M43 64 Q45 60 51 61 Q57 61 59 67 L41 67', 1.5) +
      head(D, 50, 54, .32, 'right', 'short') +
      D.path('M71 128 L71 132 M90 128 L90 132', { w: 1.8 })),

    scene('duo-hc-lower-frame-3', 'the-call-in-comfortable-pyjamas', 'hex', 'ivory', D =>
      cloth(D, 'M49 77 Q36 87 37 103 L83 105 Q84 86 63 78') +
      head(D, 58, 58, .78, 'right', 'short') +
      D.path('M49 79 L57 89 L64 81 M42 108 L77 108 M44 108 L43 127', { w: 1.9 }) +
      cloth(D, 'M53 103 Q66 101 68 111 L68 120 L80 125 Q83 129 77 130 L57 128 L55 114 Z') +
      cloth(D, 'M70 104 Q82 101 86 113 L90 123 L102 126 Q105 129 100 130 L83 130 L76 118') +
      D.path('M56 119 L68 119 M83 121 L89 119', { w: 1.6 }) +
      D.rect(87, 76, 34, 25, 2, D.paper) +
      cloth(D, 'M98 94 Q104 89 112 94 L115 99 L94 99', 1.5) +
      head(D, 106, 87, .32, 'left', 'long') +
      cloth(D, 'M41 95 Q60 97 76 95 L88 96 Q93 97 89 100 L78 102 Q61 108 44 104') +
      D.path('M32 106 L129 106 M123 106 L123 130', { w: 2 })),

    scene('duo-hc-rear-camera-3', 'a-glance-back-at-the-photographer', 'oval', 'rose', D =>
      cloth(D, 'M37 93 Q29 102 29 122 L68 128 Q73 104 51 94') +
      head(D, 45, 78, .62, 'right', 'short') +
      D.path('M37 94 L44 102 L51 96') +
      cloth(D, 'M43 115 Q53 105 55 88 L57 80 Q58 77 60 80 L60 88 Q61 107 52 123') +
      D.camera(64, 79, .44) +
      cloth(D, 'M86 84 Q106 86 118 103 L128 123 Q108 131 77 128 L72 112 Q74 95 86 84') +
      head(D, 93, 63, .89, 'left', 'long', 7) +
      D.path('M86 86 Q98 91 103 90 M104 93 Q111 106 107 125 M86 100 Q76 111 77 126')),

    scene('duo-hc-artists-entry-3', 'entering-the-stage-together', 'rosette', 'ivory', D =>
      D.path('M34 35 L126 35 M34 36 L34 126 M126 36 L126 126 M34 40 Q53 55 38 100 L29 112 M126 40 Q107 55 122 100 L131 112 M38 100 L47 102 M122 100 L113 102', { w: 1.8 }) +
      cloth(D, 'M51 79 Q42 87 43 107 L74 107 Q79 91 65 80') +
      cloth(D, 'M96 80 Q108 87 115 107 L84 108 Q80 92 89 82') +
      head(D, 59, 62, .65, 'right', 'short') +
      head(D, 98, 63, .65, 'left', 'long') +
      D.path('M52 80 L59 89 L65 82 M95 82 L100 90 L107 84') +
      cloth(D, 'M47 95 Q62 101 74 99 Q78 97 81 100 Q83 103 78 105 Q62 112 48 104') +
      D.path('M107 96 Q95 104 82 102 M49 108 L47 124 L58 128 M66 109 L68 125 L76 127 M91 109 L86 125 L94 128 M106 108 L110 124 L119 126 M29 131 L131 131', { w: 1.9 })),

    scene('duo-hc-double-booking-3', 'two-tickets-and-a-meeting', 'hex', 'sage', D =>
      D.rect(62, 34, 36, 14, 3) + D.path('M68 41 L74 41 M86 41 L92 41', { w: 1.8 }) +
      cloth(D, 'M43 85 Q31 93 31 116 L74 122 Q81 101 60 86') +
      cloth(D, 'M100 83 Q117 85 129 110 L128 122 L86 123 Q81 101 93 85') +
      head(D, 53, 66, .75, 'right', 'short') +
      head(D, 105, 64, .76, 'left', 'long') +
      D.path('M43 86 L52 96 L59 88 M99 87 L105 96 L113 87') +
      cloth(D, 'M39 105 Q57 108 72 99 Q76 97 78 100 Q80 104 75 105 Q57 119 41 115') +
      cloth(D, 'M119 104 Q104 110 93 102 Q89 99 86 102 Q84 105 89 108 Q103 120 121 114') +
      D.group(D.rect(70, 91, 11, 20, 2, D.paper) + D.path('M73 97 L78 97 M74 105 L77 105', { w: 1.4 }), 'rotate(-12 75 101)') +
      D.group(D.rect(81, 94, 11, 20, 2, D.paper) + D.path('M84 100 L89 100 M85 108 L88 108', { w: 1.4 }), 'rotate(12 86 104)') +
      D.path('M32 124 L128 124', { w: 1.9 })),

    scene('duo-hc-hour-contract-3', 'an-hour-agreed-together', 'shield', 'peach', D =>
      D.circle(80, 41, 10) + D.path('M80 34 L80 41 L85 45', { w: 1.8 }) +
      cloth(D, 'M43 90 Q32 98 32 116 L74 118 Q78 102 59 90') +
      cloth(D, 'M99 90 Q115 93 127 113 L126 119 L87 118 Q82 102 93 92') +
      head(D, 52, 73, .7, 'right', 'short') +
      head(D, 106, 73, .7, 'left', 'long') +
      D.path('M44 92 L51 101 L58 93 M99 93 Q106 99 114 93 M29 120 L131 120 M37 121 L37 131 M123 121 L123 131', { w: 1.9 }) +
      cloth(D, 'M68 106 L94 106 L98 119 L65 119 Z', 1.7) +
      cloth(D, 'M40 105 Q55 112 68 110 L75 110 Q79 111 75 114 L68 115 Q53 120 41 115') +
      cloth(D, 'M118 105 Q102 106 92 109 L88 113 Q85 115 83 112 Q82 110 86 106 Q99 97 115 98') +
      D.path('M86 104 L78 116 M81 116 L89 116', { w: 1.6 })),

    scene('duo-hc-applause-3', 'a-high-five-to-celebrate', 'rosette', 'rose', D =>
      cloth(D, 'M41 90 Q31 100 30 121 Q50 130 73 128 L80 110 Q64 94 56 91') +
      cloth(D, 'M102 91 Q120 96 130 121 Q112 130 86 128 L79 109 Q93 96 102 91') +
      cloth(D, 'M56 105 Q67 92 70 78 L72 66 L71 54 Q71 50 74 51 L77 62 L77 50 Q78 46 80 50 L80 66 L79 82 Q74 109 66 118') +
      cloth(D, 'M101 105 Q91 92 89 78 L87 65 L89 54 Q89 50 86 51 L83 61 L83 50 Q82 46 80 50 L80 66 L80 82 Q85 109 94 118') +
      head(D, 49, 71, .77, 'right', 'short', -4) +
      head(D, 111, 72, .77, 'left', 'long', 4) +
      D.path('M41 92 L50 102 L56 94 M103 94 Q111 102 119 96 M71 70 L79 71 M81 71 L88 70', { w: 1.8 })),

    scene('duo-hc-private-cinema-3', 'the-sofa-becomes-a-film-set', 'rosette', 'sage', D =>
      D.rect(59, 93, 70, 34, 11, D.paper) +
      D.path('M44 89 L44 124 M41 89 L32 124 M47 89 L57 124', { w: 1.8 }) +
      D.camera(44, 80, .49) +
      cloth(D, 'M67 91 Q58 100 58 118 L96 126 Q103 103 81 92') +
      cloth(D, 'M101 93 Q118 93 128 115 L126 127 L92 129 Q86 108 95 95') +
      kissHead(D, 75.7, 73, .7, 'right', 'short') +
      kissHead(D, 102.3, 73, .7, 'left', 'long') +
      D.path('M68 91 L75 100 L81 92 M101 93 Q108 100 116 96') +
      cloth(D, 'M109 109 Q98 99 96 91 L96 85 Q95 82 93 85 L92 92 Q91 104 101 117') +
      cloth(D, 'M63 120 Q80 111 100 120 L124 129 L64 130 Z', 1.9)),

    scene('duo-hc-studio-3', 'the-portrait-under-the-studio-lamp', 'hex', 'ivory', D =>
      D.path('M77 35 L126 35 L126 124 M85 35 L83 41', { w: 1.8 }) +
      cloth(D, 'M72 49 Q75 40 83 40 Q91 40 95 49 Z', 1.8) +
      cloth(D, 'M37 92 Q29 101 29 121 L65 127 Q72 104 51 93') +
      head(D, 45, 76, .64, 'right', 'short') +
      D.path('M37 94 L44 102 L51 95') +
      cloth(D, 'M41 113 Q50 105 53 89 L55 81 Q56 78 59 80 L59 88 Q59 109 50 121') +
      D.camera(64, 78, .47) +
      cloth(D, 'M96 86 Q109 85 117 98 L123 126 L85 128 Q80 106 96 86') +
      head(D, 101, 67, .77, 'left', 'long', -3) +
      D.path('M94 89 L101 98 L108 89 M114 100 Q121 110 111 114 L105 113 M89 105 Q83 115 89 123 M94 128 L99 116', { w: 1.9 })),

    scene('duo-hc-glide-3', 'a-gentle-shoulder-massage', 'oval', 'sage', D =>
      cloth(D, 'M45 82 Q33 90 32 117 L72 128 Q80 98 61 83') +
      cloth(D, 'M89 92 Q109 92 124 110 L129 125 Q105 131 79 128 L73 111 Q77 100 89 92') +
      head(D, 54, 63, .79, 'right', 'short', 4) +
      head(D, 99, 72, .82, 'right', 'long', 13) +
      D.path('M45 84 L53 94 L60 85 M91 95 Q103 103 113 98 M103 108 L106 126') +
      cloth(D, 'M40 102 Q60 99 76 89 L83 86 Q88 86 88 89 L82 92 Q88 90 90 93 Q91 96 85 97 L78 97 Q60 111 42 113') +
      cloth(D, 'M58 109 Q72 105 88 98 L96 96 Q101 97 99 100 L93 103 Q98 101 100 104 Q100 107 94 108 L88 108 Q75 120 60 121')),

    scene('duo-hc-remake-3', 'rehearsing-the-scene-at-home', 'shield', 'peach', D =>
      D.path('M35 40 L35 71 M35 40 L64 40 M125 40 L125 71 M125 40 L96 40', { w: 1.8 }) +
      cloth(D, 'M44 88 Q33 96 31 119 L76 129 Q82 104 60 89') +
      cloth(D, 'M99 88 Q115 90 128 115 L128 128 L87 129 Q82 105 93 90') +
      head(D, 53, 69, .76, 'right', 'short', -2) +
      head(D, 106, 69, .76, 'left', 'long', 2) +
      D.path('M45 90 L52 100 L59 92 M99 91 L106 100 L114 92') +
      cloth(D, 'M40 108 Q58 110 72 98 Q76 95 79 97 Q82 100 77 103 Q60 121 41 118') +
      cloth(D, 'M120 107 Q105 112 93 102 L85 98 Q81 98 82 102 L89 107 Q103 123 121 117') +
      D.rect(68, 112, 28, 17, 2, D.paper) +
      cloth(D, 'M68 111 L92 104 L95 110 L70 117 Z', 1.8) +
      D.path('M74 110 L78 114 M83 107 L87 112 M75 123 L88 123', { w: 1.6 }))
  ];

  const api = Object.freeze(scenes);
  scope.OndeBadgeScenesIntimacy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
