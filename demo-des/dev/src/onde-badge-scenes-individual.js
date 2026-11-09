/* Dés·ir — individual rewards, drawn as quiet scenes in one continuous line style. */
(function(scope){
 'use strict';
 const scenes=[
  {
   id:'ind-draws-1',motif:'first-open-palm',shape:'circle',tone:'peach',
   draw:D=>[
    D.path('M31 128 C31 105 33 87 49 77 M62 79 Q72 85 74 98 M43 96 Q43 111 51 121 L66 128'),
    D.path('M44 108 Q65 116 88 102 Q96 97 103 98 Q110 93 113 97 Q114 101 104 105 L78 116 Q60 127 48 120'),
    D.path('M88 102 Q91 95 96 94 Q101 93 102 97 M100 102 L108 100',{w:1.8}),
    D.head(57,58,.9,{facing:'right',hair:'short',tilt:-6}),
    D.die(106,87,14,1,-10)
   ].join('')
  },
  {
   id:'ind-draws-5',motif:'shared-table-roll',shape:'hex',tone:'ivory',
   draw:D=>[
    D.path('M28 108 Q80 101 132 108 M31 112 L33 130 M129 112 L127 130'),
    D.path('M29 103 Q29 82 40 70 M50 74 Q64 82 66 94 M39 89 Q40 99 53 102 L71 103'),
    D.path('M49 97 Q59 96 68 99 Q74 100 73 103 M65 102 L71 104',{w:1.8}),
    D.path('M130 104 Q129 84 116 75 M105 77 Q95 84 94 95 M120 91 Q119 101 105 103 L91 103'),
    D.path('M105 98 Q98 97 94 99 L89 102',{w:1.8}),
    D.head(49,57,.7,{facing:'right',hair:'short',tilt:5}),
    D.head(106,61,.65,{facing:'left',hair:'long',tilt:-5}),
    D.die(80,101,12,5,7)
   ].join('')
  },
  {
   id:'ind-draws-15',motif:'loose-wrist-toss',shape:'oval',tone:'sage',
   draw:D=>[
    D.path('M29 128 Q27 94 43 74 M54 75 Q61 87 65 101 M39 96 Q42 111 54 122 Q72 124 90 99'),
    D.path('M54 110 Q69 113 89 86 L99 76 Q102 71 101 67 Q101 63 104 65 L109 73 Q113 70 115 73 Q116 78 108 84 L94 103'),
    D.path('M102 77 Q109 79 112 77 M105 71 L109 76',{w:1.8}),
    D.head(48,58,.75,{facing:'right',hair:'short',tilt:-12}),
    D.die(109,52,14,3,24),
    D.path('M94 43 Q101 37 109 39 M91 51 Q92 47 94 46',{w:1.8})
   ].join('')
  },
  {
   id:'ind-draws-30',motif:'rolling-table-gesture',shape:'shield',tone:'peach',
   draw:D=>[
    D.path('M29 120 Q70 133 118 120 M31 120 Q49 114 68 115'),
    D.path('M99 80 Q119 86 126 128 M86 79 Q80 87 83 101 M112 94 Q118 105 112 116'),
    D.path('M108 103 Q91 99 76 103 L63 109 Q56 110 54 114 Q55 118 62 116 L77 113 Q97 113 110 121'),
    D.path('M61 112 L71 108 M66 115 L75 111',{w:1.8}),
    D.head(92,61,.8,{facing:'left',hair:'long',tilt:10}),
    D.die(43,116,13,4,-20)
   ].join('')
  },
  {
   id:'ind-draws-75',motif:'relaxed-seat-and-die',shape:'rosette',tone:'ivory',
   draw:D=>[
    D.path('M31 78 Q28 100 34 121 Q38 128 57 128 L113 128 M34 122 L32 131 M109 128 L111 132'),
    D.path('M48 73 Q36 82 42 108 Q48 119 66 119 Q84 115 100 127 M62 74 Q73 83 75 97'),
    D.path('M48 91 Q55 105 74 104 L99 96 Q108 91 113 95 Q115 99 108 102 L80 113 Q59 120 45 107'),
    D.path('M98 97 Q99 91 103 92 L106 95 M104 100 L112 98',{w:1.8}),
    D.path('M49 77 Q56 81 62 77 M66 119 Q65 125 70 131'),
    D.head(58,54,.85,{facing:'right',hair:'long',tilt:-4}),
    D.die(108,87,13,6,6)
   ].join('')
  },
  {
   id:'ind-proposals-1',motif:'an-idea-in-conversation',shape:'oval',tone:'peach',
   draw:D=>[
    D.path('M29 129 Q27 98 43 79 M54 82 Q66 88 69 107 M41 99 Q47 121 65 118 Q77 110 83 89'),
    D.path('M65 106 Q72 103 75 85 L75 68 Q75 63 78 64 Q81 65 80 74 L80 80 Q85 75 88 79 Q91 81 88 87 L83 98'),
    D.path('M80 80 L83 88 M83 80 L86 86',{w:1.8}),
    D.path('M130 129 Q130 108 121 97 M109 97 Q100 103 97 122 M119 112 Q112 121 103 124'),
    D.head(52,62,.78,{facing:'right',hair:'short'}),
    D.head(113,80,.7,{facing:'left',hair:'long'})
   ].join('')
  },
  {
   id:'ind-proposals-5',motif:'box-of-small-invitations',shape:'shield',tone:'sage',
   draw:D=>[
    D.path('M31 129 Q29 91 46 76 M59 80 Q73 84 79 101 M43 93 Q47 109 64 113 M75 94 Q82 106 97 112'),
    D.path('M57 107 L97 102 L111 113 L72 120 Z M57 107 L59 125 L73 131 L110 124 L111 113 M72 120 L73 131'),
    D.path('M57 107 L52 96 L91 92 L97 102 M72 120 L73 109 L107 104 L111 113'),
    D.path('M94 93 L91 73 L106 70 L109 90 Z',{fill:D.paper}),
    D.path('M76 91 Q81 98 91 98 L102 96 Q107 94 105 90 Q104 87 98 90 L94 92 M97 89 L99 85 Q102 83 103 86',{fill:D.paper}),
    D.head(57,59,.82,{facing:'right',hair:'short'})
   ].join('')
  },
  {
   id:'ind-proposals-15',motif:'invitation-through-the-window',shape:'hex',tone:'ivory',
   draw:D=>[
    D.path('M32 94 L32 37 L129 37 L129 94 M36 41 L125 41 M80 42 L80 80 M28 98 Q80 95 132 98'),
    D.path('M36 94 Q37 80 48 76 M59 79 Q69 84 72 94'),
    D.path('M126 94 Q125 84 115 79 M105 80 Q96 85 92 93'),
    D.path('M47 89 Q55 98 74 100 L85 98 M116 91 Q107 103 92 105 L81 106'),
    D.path('M70 91 L89 88 L96 103 L76 106 Z M70 91 L83 99 L89 88',{fill:D.paper}),
    D.path('M67 100 Q73 97 78 100 M94 103 Q89 99 85 103',{w:1.8}),
    D.path('M43 110 Q51 116 55 129 M118 109 Q113 119 112 129'),
    D.head(57,62,.7,{facing:'right',hair:'long'}),
    D.head(108,65,.67,{facing:'left',hair:'short'})
   ].join('')
  },
  {
   id:'ind-proposals-30',motif:'a-page-of-possibilities',shape:'circle',tone:'rose',
   draw:D=>[
    D.path('M29 116 Q79 111 131 116 M33 119 L34 131 M127 119 L126 131'),
    D.path('M30 110 Q29 85 46 76 M58 78 Q73 85 76 101 M42 95 Q48 110 66 107'),
    D.path('M64 109 Q77 102 89 107 L91 122 Q77 117 64 122 Z M89 107 Q106 101 121 107 L120 120 Q104 116 91 122',{fill:D.paper}),
    D.path('M55 98 Q67 105 79 100 L88 95 Q93 93 94 96 Q95 100 89 103 L82 107 M90 99 L96 84 M97 84 L99 81',{fill:D.paper}),
    D.path('M69 113 Q76 110 83 112 M99 111 Q106 108 113 110',{w:1.7}),
    D.head(55,59,.8,{facing:'right',hair:'long',tilt:5})
   ].join('')
  },
  {
   id:'ind-proposals-75',motif:'the-door-is-open',shape:'rosette',tone:'peach',
   draw:D=>[
    D.path('M88 130 L88 33 L125 33 L125 130 M91 37 L112 44 L112 125 L91 130'),
    D.circle(106,91,1.2,D.ink),
    D.path('M30 130 Q30 94 45 78 M56 81 Q73 87 76 111 M43 94 Q48 106 61 107 Q78 109 94 93'),
    D.path('M57 99 Q72 101 90 87 L101 82 Q106 81 108 85 Q109 89 102 91 L94 94 M98 85 Q97 80 101 79 L104 82',{fill:D.paper}),
    D.path('M42 113 Q51 121 66 130'),
    D.head(54,61,.82,{facing:'right',hair:'short'})
   ].join('')
  },
  {
   id:'ind-participations-1',motif:'meeting-with-open-hands',shape:'circle',tone:'ivory',
   draw:D=>[
    D.path('M29 129 Q29 96 43 80 M54 83 Q67 90 69 105 M40 97 Q48 118 68 112 L84 101'),
    D.path('M131 129 Q131 98 116 83 M104 86 Q92 91 89 108 M120 100 Q111 117 96 112 L80 104'),
    D.path('M72 103 Q77 98 83 99 Q88 98 90 102 Q91 106 85 109 L78 111 Q74 110 76 107 M79 103 L86 103',{fill:D.paper}),
    D.head(52,64,.78,{facing:'right',hair:'short'}),
    D.head(107,67,.75,{facing:'left',hair:'long'})
   ].join('')
  },
  {
   id:'ind-participations-5',motif:'two-mugs-and-a-toast',shape:'hex',tone:'peach',
   draw:D=>[
    D.path('M28 117 Q80 111 132 117 M33 121 L34 132 M127 121 L126 132'),
    D.path('M29 111 Q28 88 43 79 M54 82 Q66 89 68 102 M39 96 Q45 109 61 105 L70 95'),
    D.path('M131 111 Q132 90 116 82 M104 85 Q94 91 91 103 M121 99 Q114 110 100 106 L91 97'),
    D.path('M64 82 L78 83 L77 99 Q69 103 64 97 Z M65 85 Q57 82 57 90 Q58 95 65 94',{fill:D.paper}),
    D.path('M84 84 L98 82 L99 96 Q94 102 86 98 Z M98 85 Q106 81 107 89 Q107 95 100 94',{fill:D.paper}),
    D.path('M61 95 Q66 92 69 97 M103 96 Q98 93 95 98',{w:1.8}),
    D.head(52,62,.78,{facing:'right',hair:'short'}),
    D.head(107,65,.75,{facing:'left',hair:'long'})
   ].join('')
  },
  {
   id:'ind-participations-15',motif:'a-playful-turn-together',shape:'oval',tone:'sage',
   draw:D=>[
    D.path('M41 74 Q32 88 34 107 Q44 112 56 107 L60 87 M51 77 Q58 85 62 94'),
    D.path('M35 107 Q35 119 29 128 M48 110 Q48 122 60 129 M29 128 L38 130 M60 129 L66 127'),
    D.path('M114 79 Q124 90 127 111 Q115 118 102 113 L96 94 M104 81 Q96 86 93 96'),
    D.path('M108 116 Q109 125 100 131 M122 115 Q122 124 130 129'),
    D.path('M54 86 Q66 80 72 61 Q73 55 78 56 Q82 55 83 61 Q90 79 103 89 M62 94 Q71 85 77 68 M94 96 Q85 86 80 69'),
    D.path('M74 59 Q78 63 81 59',{w:1.8}),
    D.head(48,60,.65,{facing:'right',hair:'short'}),
    D.head(106,64,.65,{facing:'left',hair:'long'})
   ].join('')
  },
  {
   id:'ind-participations-30',motif:'a-steady-shoulder',shape:'shield',tone:'rose',
   draw:D=>[
    D.path('M29 119 Q80 127 131 119 M34 123 L34 131 M126 123 L126 131'),
    D.path('M33 118 Q30 94 49 79 M60 83 Q74 89 75 112 M43 99 Q52 113 72 113'),
    D.path('M79 117 Q81 101 88 93 M103 92 Q120 99 127 118'),
    D.path('M62 92 Q75 82 91 89 Q105 91 114 103 M115 100 Q119 100 121 104 Q122 108 118 109'),
    D.path('M95 106 Q89 115 77 115 M47 121 Q49 126 47 131 M115 121 Q115 126 118 131'),
    D.head(58,62,.85,{facing:'right',hair:'short'}),
    D.head(93,77,.78,{facing:'left',hair:'long',tilt:-23})
   ].join('')
  },
  {
   id:'ind-completed-sent-5',motif:'a-picnic-that-happened',shape:'rosette',tone:'sage',
   draw:D=>[
    D.path('M28 124 Q75 111 128 121 L132 131 Q76 124 30 132 Z M42 122 L46 130 M109 119 L113 128',{w:1.8}),
    D.path('M34 115 Q30 94 43 80 M53 83 Q65 89 67 104 M43 99 Q50 109 64 110 L78 105'),
    D.path('M121 113 Q130 97 115 83 M104 86 Q94 91 92 106 M119 101 Q106 112 93 110 L81 106'),
    D.path('M39 115 Q49 112 63 120 L77 124 M119 115 Q106 114 96 121 L85 126'),
    D.path('M67 110 Q79 117 93 110 Q92 123 81 123 Q71 122 67 110',{fill:D.paper}),
    D.path('M77 105 Q81 102 85 105 M79 103 L80 99',{w:1.8}),
    D.head(51,65,.7,{facing:'right',hair:'short'}),
    D.head(107,68,.7,{facing:'left',hair:'long'})
   ].join('')
  },
  {
   id:'ind-completed-sent-15',motif:'taking-the-scenic-path',shape:'oval',tone:'ivory',
   draw:D=>[
    D.path('M30 130 Q64 116 126 130 M31 121 Q66 111 98 118',{w:1.8}),
    D.path('M47 66 Q36 77 38 98 Q47 102 60 97 M56 69 Q66 77 66 89'),
    D.path('M40 99 Q39 111 30 121 L36 124 M53 100 Q58 113 68 120 L75 119'),
    D.path('M95 74 Q84 84 86 105 Q99 110 111 103 M107 76 Q119 85 120 99'),
    D.path('M89 107 Q86 118 82 128 L89 131 M104 107 Q108 116 121 124 L129 123'),
    D.path('M63 82 Q72 93 82 92 L88 87 M66 91 Q77 103 88 94 M79 93 Q82 89 85 92',{fill:D.paper}),
    D.path('M109 87 Q118 91 128 84 M119 98 Q126 95 131 91'),
    D.head(54,52,.65,{facing:'right',hair:'short'}),
    D.head(104,59,.7,{facing:'right',hair:'long'})
   ].join('')
  },
  {
   id:'ind-completed-received-5',motif:'accepting-an-open-hand',shape:'shield',tone:'peach',
   draw:D=>[
    D.path('M31 128 Q29 101 43 86 M55 89 Q69 96 70 112 M43 103 Q51 121 65 115 L82 95'),
    D.path('M68 108 Q74 105 78 94 Q79 87 84 88 Q89 86 90 91 Q91 97 85 102 L78 113'),
    D.path('M132 77 Q114 74 96 86 L87 91 M132 88 Q114 85 97 95 L89 99'),
    D.path('M94 87 Q89 82 86 87 L84 92 M85 94 Q88 97 92 94',{w:1.8}),
    D.path('M44 118 Q42 126 46 132'),
    D.head(52,68,.78,{facing:'right',hair:'long',tilt:-3})
   ].join('')
  },
  {
   id:'ind-completed-received-15',motif:'stepping-out-together',shape:'hex',tone:'sage',
   draw:D=>[
    D.path('M31 128 L31 36 L64 36 M35 41 L54 48 L54 111 M28 131 L131 131'),
    D.path('M58 74 Q47 84 50 104 Q60 108 72 103 M68 77 Q76 84 78 96'),
    D.path('M52 105 Q53 115 46 126 L54 129 M64 106 Q69 117 80 125 L87 124'),
    D.path('M103 67 Q91 77 92 98 Q104 103 116 97 M113 70 Q124 78 127 91'),
    D.path('M95 100 Q92 111 87 121 L94 125 M109 100 Q114 112 125 119 L132 117'),
    D.path('M72 87 Q78 95 87 88 L96 81 M78 97 Q85 103 94 93 L102 87 M84 91 Q87 88 90 91',{fill:D.paper}),
    D.head(65,59,.67,{facing:'right',hair:'short'}),
    D.head(111,51,.7,{facing:'right',hair:'long'})
   ].join('')
  },
  {
   id:'ind-complicite-3',motif:'a-small-whisper',shape:'circle',tone:'rose',
   draw:D=>[
    D.path('M29 130 Q31 95 49 86 M62 90 Q76 99 78 125'),
    D.path('M130 130 Q129 91 108 83 M96 88 Q85 95 83 124'),
    D.path('M44 106 Q54 121 67 115 Q77 102 81 86 L79 74 Q78 70 82 70 Q86 70 86 77 L87 87 Q87 96 84 105'),
    D.path('M77 81 L80 91 M83 78 L84 89',{w:1.8}),
    D.head(60,68,.85,{facing:'right',hair:'short',tilt:12}),
    D.head(99,65,.85,{facing:'left',hair:'long',tilt:-5})
   ].join('')
  },
  {
   id:'ind-complicite-10',motif:'a-swing-for-two',shape:'oval',tone:'ivory',
   draw:D=>[
    D.path('M33 30 L38 111 M127 30 L122 111 M35 112 Q80 121 125 112 L123 119 Q81 127 37 119 Z'),
    D.path('M42 111 Q40 87 54 78 M65 81 Q76 87 78 105 M122 111 Q123 87 109 78 M97 81 Q85 88 83 105'),
    D.path('M45 99 Q58 110 72 106 L82 99 M116 99 Q103 110 90 106 L80 99'),
    D.path('M72 102 Q78 97 82 101 Q85 103 88 102',{w:1.8}),
    D.path('M51 120 Q49 126 54 131 M66 122 L70 132 M99 123 L95 132 M113 120 Q116 126 113 132'),
    D.head(62,62,.75,{facing:'right',hair:'short'}),
    D.head(100,62,.75,{facing:'left',hair:'long'})
   ].join('')
  },
  {
   id:'ind-attention-3',motif:'a-flower-kept-in-the-hand',shape:'shield',tone:'peach',
   draw:D=>[
    D.path('M33 130 Q30 97 46 80 M59 84 Q75 92 77 114 M45 100 Q51 120 69 114 L89 104'),
    D.path('M64 105 Q75 108 87 98 Q92 94 96 96 Q100 98 96 102 L88 109'),
    D.path('M93 112 Q99 91 106 72 M99 92 Q112 93 115 85 Q106 81 100 88 M104 79 Q94 80 92 72 Q100 69 104 76'),
    D.path('M106 70 C96 71 94 63 100 60 C98 51 106 48 110 55 C117 49 124 55 119 62 C126 67 119 74 113 70 Q110 76 106 70 Z',{fill:D.paper}),
    D.path('M107 63 Q111 58 114 63 Q116 67 111 68 Q107 68 107 63',{w:1.8}),
    D.head(57,62,.85,{facing:'right',hair:'long'})
   ].join('')
  },
  {
   id:'ind-attention-10',motif:'a-taste-offered-in-the-kitchen',shape:'rosette',tone:'sage',
   draw:D=>[
    D.path('M28 116 Q80 112 132 116 M34 120 L34 132 M126 120 L126 132'),
    D.path('M30 110 Q29 88 43 78 M54 81 Q64 86 67 99 M41 94 Q46 105 60 102 L85 86'),
    D.path('M58 95 Q71 92 85 81 L93 80 M90 80 L107 77'),
    D.ellipse(108,77,5,2.5,D.paper),
    D.path('M131 111 Q130 91 117 83 M105 86 Q98 94 98 107 M119 99 Q116 106 105 109'),
    D.path('M51 109 L84 109 Q81 125 68 125 Q55 124 51 109 Z',{fill:D.paper}),
    D.path('M45 84 L42 109 M58 88 L64 108 M119 90 L124 110',{w:1.8}),
    D.head(52,62,.75,{facing:'right',hair:'short'}),
    D.head(110,67,.65,{facing:'left',hair:'long',tilt:-5})
   ].join('')
  },
  {
   id:'ind-projets-3',motif:'hands-on-the-drawing-board',shape:'hex',tone:'ivory',
   draw:D=>[
    D.path('M28 110 L129 110 L132 116 L29 116 Z M35 119 L35 132 M124 119 L124 132'),
    D.path('M31 107 Q29 86 44 77 M55 80 Q69 86 71 101 M42 94 Q50 103 64 102 L77 96'),
    D.path('M128 107 Q129 88 116 80 M105 83 Q94 90 92 102 M117 95 Q112 103 99 103 L86 99'),
    D.path('M58 107 L103 104 M65 106 L65 109 M77 106 L77 108 M89 105 L89 108',{w:1.8}),
    D.path('M74 98 Q78 94 82 97 L87 101 M82 99 L87 84 M88 84 L90 81',{w:1.8}),
    D.head(52,61,.75,{facing:'right',hair:'short'}),
    D.head(107,64,.7,{facing:'left',hair:'long'})
   ].join('')
  },
  {
   id:'ind-projets-10',motif:'hanging-the-picture-together',shape:'shield',tone:'rose',
   draw:D=>[
    D.rect(60,37,41,44,2),
    D.path('M65 42 L96 42 L96 76 L65 76 Z M66 68 Q76 53 84 65 Q91 60 96 68',{w:1.8}),
    D.path('M30 130 Q28 103 41 91 M52 95 Q65 104 66 126'),
    D.path('M131 130 Q133 105 121 93 M109 97 Q95 106 94 126'),
    D.head(49,75,.7,{facing:'right',hair:'short',tilt:-8}),
    D.head(113,77,.7,{facing:'left',hair:'long',tilt:8}),
    D.path('M37 110 Q30 95 36 80 L55 58 Q58 54 61 57 Q63 60 60 64 L46 85 Q42 98 47 106',{fill:D.paper}),
    D.path('M125 112 Q132 97 126 82 L107 59 Q104 55 101 58 Q99 61 102 65 L116 87 Q120 100 115 108',{fill:D.paper})
   ].join('')
  },
  {
   id:'ind-intimite-3',motif:'foreheads-near-the-window',shape:'circle',tone:'peach',
   draw:D=>[
    D.path('M31 81 L31 36 L67 36 M93 36 L129 36 L129 81',{w:1.8}),
    D.path('M29 130 Q30 100 48 86 M61 91 Q72 104 77 128 M131 130 Q130 100 112 86 M99 91 Q88 104 83 128'),
    D.path('M44 105 Q63 123 88 118 L109 107 M111 102 Q116 101 118 106 Q118 110 112 111'),
    D.path('M114 119 Q98 132 77 125 M48 86 Q54 91 61 91 M112 86 Q106 91 99 91'),
    D.head(61,68,.85,{facing:'right',hair:'short',tilt:13}),
    D.head(99,67,.85,{facing:'left',hair:'long',tilt:-13})
   ].join('')
  },
  {
   id:'ind-intimite-10',motif:'a-quiet-curtain-and-caress',shape:'oval',tone:'rose',
   draw:D=>[
    D.path('M29 32 Q41 63 29 96 M36 32 Q49 63 36 91 M132 32 Q121 69 132 105',{w:1.8}),
    D.path('M31 129 Q30 98 47 86 M60 90 Q75 102 77 126 M130 129 Q129 100 111 89 M98 93 Q88 104 85 126'),
    D.path('M44 106 Q55 123 68 115 Q78 101 85 86 L87 76 Q88 72 92 74 Q95 76 92 82 L91 90 Q86 109 79 121'),
    D.path('M88 79 Q92 81 94 79 M99 109 Q91 119 80 122',{w:1.8}),
    D.head(58,68,.85,{facing:'right',hair:'short',tilt:7}),
    D.head(102,71,.85,{facing:'left',hair:'long',tilt:-6})
   ].join('')
  },
  {
   id:'ind-active-days-3',motif:'crossing-paths-again',shape:'hex',tone:'sage',
   draw:D=>[
    D.path('M28 130 Q69 119 132 128',{w:1.8}),
    D.path('M40 74 Q28 85 31 105 Q43 111 55 105 M50 77 Q60 84 61 96'),
    D.path('M33 108 Q31 119 28 126 L34 130 M47 109 Q51 120 61 126 L68 124'),
    D.path('M119 81 Q131 92 128 111 Q116 117 103 110 M108 83 Q98 91 97 102'),
    D.path('M125 114 Q127 124 132 130 M111 114 Q105 124 97 129 L90 127'),
    D.path('M57 87 Q69 88 71 73 L70 64 Q70 60 73 61 L75 68 L77 59 Q78 56 80 59 L80 72 Q82 84 71 95'),
    D.path('M101 94 Q91 90 91 76 L92 68 Q93 63 96 66 L96 71 L99 64 Q101 61 103 64 L101 79 Q103 88 110 91'),
    D.head(48,59,.67,{facing:'right',hair:'short'}),
    D.head(111,66,.67,{facing:'left',hair:'long'})
   ].join('')
  },
  {
   id:'ind-active-days-10',motif:'the-morning-window-ritual',shape:'circle',tone:'ivory',
   draw:D=>[
    D.path('M84 36 L128 36 L128 91 L84 91 Z M88 40 L124 40 L124 87 M106 41 L106 87 M85 64 L127 64',{w:1.8}),
    D.path('M29 129 Q28 95 44 79 M57 83 Q73 89 77 111 M42 96 Q49 116 70 112 L89 104'),
    D.path('M60 102 Q75 103 86 96 M85 94 L100 94 L99 108 Q92 113 86 107 Z M101 96 Q109 93 109 101 Q109 107 100 106',{fill:D.paper}),
    D.path('M87 105 Q89 101 94 104 M91 88 Q86 82 92 77',{w:1.8}),
    D.path('M46 118 Q51 125 64 131'),
    D.head(55,61,.85,{facing:'right',hair:'long'})
   ].join('')
  },
  {
   id:'ind-active-streak-3',motif:'a-familiar-little-wave',shape:'rosette',tone:'peach',
   draw:D=>[
    D.path('M30 130 Q28 98 46 82 M59 86 Q72 93 75 116 M44 103 Q53 123 70 119 Q86 109 91 88'),
    D.path('M70 106 Q81 99 83 85 L82 70 Q82 66 85 67 L89 81 L89 62 Q89 58 92 60 L94 79 L97 64 Q98 60 101 63 L99 83 L105 74 Q108 70 110 73 Q111 76 108 80 L102 91 Q100 104 91 115'),
    D.path('M90 86 Q96 83 101 88',{w:1.8}),
    D.head(56,64,.85,{facing:'right',hair:'short'}),
    D.path('M118 64 Q123 69 122 75',{w:1.8})
   ].join('')
  },
  {
   id:'ind-distinct-variants-6',motif:'a-self-portrait-in-progress',shape:'shield',tone:'sage',
   draw:D=>[
    D.path('M91 33 L87 130 M124 36 L130 130 M86 118 L130 118 M90 39 L126 41 L123 103 L87 100 Z'),
    D.path('M103 57 Q96 59 97 70 Q97 77 105 78 L105 84 M110 58 Q117 61 115 67 L119 71 L114 73 Q115 78 110 79 L110 85 M104 84 Q94 88 94 96 M111 85 Q119 89 120 98 M108 67 Q110 69 112 67',{w:1.8}),
    D.path('M30 130 Q28 96 43 81 M54 84 Q68 91 71 110 M40 99 Q49 119 63 113 L82 91'),
    D.path('M61 102 Q70 100 77 87 Q80 82 85 84 Q89 86 85 91 L80 95 M83 87 L98 75',{fill:D.paper}),
    D.path('M42 116 Q52 126 66 131'),
    D.head(52,65,.78,{facing:'right',hair:'short'})
   ].join('')
  }
 ];
 const api=Object.freeze(scenes.map(scene=>Object.freeze(scene)));
 scope.OndeBadgeScenesIndividual=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
