/* Dés·ir — original shared-badge scenes, drawn with the common monoline API. */
(function(scope){
  'use strict';
  const scene=(id,motif,shape,tone,draw)=>Object.freeze({id,motif,shape,tone,draw});
  const scenes=Object.freeze([
    scene('duo-completed-1','first-joined-hands','circle','peach',D=>
      D.path('M48.8 76Q34 86 29 126M59.3 79Q69 88 71 99L79 104M100.8 79Q91 88 88 99L80 104M112.8 77.5Q127 89 131 126')+
      D.path('M46 87L55 94L63 86M98 87L105 93L114 87M43 105L51 128M116 105L111 128')+
      D.path('M68 101Q75 96 82 101L91 105Q88 111 82 109L75 107Z',{fill:D.paper})+
      D.path('M77 102L84 106M75 106L80 109')+
      D.head(57,61,.75,{facing:'right',hair:'short',tilt:0})+
      D.head(103,61,.75,{facing:'left',hair:'long',tilt:0})),
    scene('duo-completed-5','learning-a-dance','hex','sage',D=>
      D.path('M56.5 59.5Q47 63 43 75Q43 87 47 96Q59 103 76 99Q79 87 77 75M65 61.2Q72 69 80 71M48 78Q43 82 39 88Q47 98 59 101M60 75Q58 86 58 93')+
      D.path('M59 102Q58 115 50 127Q54 130 61 130M75 100Q78 113 91 127Q96 130 102 129M106.9 72.2Q115 78 113 91Q112 100 125 113Q113 119 99 113Q86 103 89 90Q91 78 97.2 72')+
      D.path('M94 82Q84 83 76 75M105 82Q111 87 117 92Q115 98 107 101M101 115Q101 123 97 129Q102 131 108 130M115 117Q120 121 124 126Q128 128 131 127')+
      D.path('M75 72L80 67Q85 63 89 67L86 73L81 76M52 99Q59 105 64 100')+
      D.head(62,47,.6,{facing:'right',hair:'short',tilt:-5})+
      D.head(101,58,.6,{facing:'left',hair:'long',tilt:8})),
    scene('duo-completed-10','making-a-memory-album','shield','ivory',D=>
      D.path('M47 68.2Q35 79 30 103L47 109M55.4 72.9Q67 77 75 86L68 95M104.8 73.9Q91 78 83 87L89 96M115 70.8Q125 81 131 103L113 110')+
      D.path('M43 89L48 100L62 101M117 90L112 101L99 102M29 114H131M44 115L41 130M118 115L122 130')+
      D.path('M54 91Q68 86 80 92Q93 86 107 91L104 111Q92 106 80 113Q68 107 57 111Z',{fill:D.paper})+
      D.path('M80 92V112M61 95L73 94L74 104L62 106ZM88 97L99 95M89 103L99 101')+
      D.path('M61 92L66 89L71 92M90 92L95 89L101 92')+
      D.head(57,57,.66,{facing:'right',hair:'short',tilt:13})+
      D.head(104,58,.66,{facing:'left',hair:'long',tilt:-10})),
    scene('duo-completed-25','flowers-on-the-bench','oval','rose',D=>
      D.path('M48.4 69.9Q34 83 34 105L60 110L58 127M57.6 73.4Q64 80 66 88L78 92M105 78Q91 89 90 105L109 111L117 130M115.3 75.4Q124 85 125 107')+
      D.path('M42 89L48 99L73 101M115 91L108 101L88 100M29 113H131M37 114V129M123 114V130M62 111L76 130')+
      D.path('M74 101L83 88M79 101L84 85M82 92Q74 91 75 84Q83 85 82 92M84 89Q91 86 94 90Q90 96 84 94')+
      D.path('M79 80Q72 74 77 68Q81 64 84 70Q89 65 92 71Q94 77 85 83Z',{fill:D.paper})+
      D.path('M72 98Q78 94 84 98L89 101M82 99L86 104')+
      D.head(57,57,.68,{facing:'right',hair:'short',tilt:5})+
      D.head(105,62,.66,{facing:'left',hair:'long',tilt:-7})),
    scene('duo-completed-50','sharing-an-anniversary-cake','rosette','ivory',D=>
      D.path('M36.6 75.5Q28 87 28 112M45.6 79Q54 82 60 88L68 91M113.4 79Q104 81 97 87L92 91M123.8 76.7Q132 90 132 111')+
      D.path('M36 92L44 104L59 105M123 93L116 104L103 105M31 119H129M41 120V131M119 120V131')+
      D.path('M62 94L65 89L72 90M91 90L96 89L100 94')+
      D.ellipse(81,98,22,5,D.paper)+D.path('M59 98V113Q80 122 103 113V98M61 108Q68 104 75 108Q82 112 89 108Q96 104 102 108')+
      D.path('M79 93V83H84V93M82 79Q75 75 82 68Q88 75 82 79Z',{fill:D.paper})+
      D.head(45,63,.66,{facing:'right',hair:'short',tilt:5})+
      D.head(114,63,.66,{facing:'left',hair:'long',tilt:-5})),
    scene('duo-completed-100','together-at-the-summit','hex','sage',D=>
      D.path('M28 82L44 54L59 75M93 47L112 31L132 56M106 38L111 43L117 39')+
      D.path('M55.6 76.4Q44 91 43 113L64 118Q72 101 72 91Q72 85 65 79.1',{fill:D.paper})+
      D.path('M91.2 77.5Q78 86 76 112L108 120L118 101Q115 84 102.2 78.1',{fill:D.paper})+
      D.path('M62 89Q81 79 105 88L110 93M99 88L102 92M54 117L51 128M63 118L72 128M90 116L88 126M108 119L115 128M28 130Q79 115 132 130')+
      D.head(63,63,.67,{facing:'right',hair:'short',tilt:0})+
      D.head(99,62,.68,{facing:'right',hair:'long',tilt:-4})),
    scene('duo-completed-250','a-box-full-of-moments','shield','ivory',D=>
      D.path('M42.3 67.6Q30 82 29 102M51.3 71.2Q64 80 68 90M110.7 72.2Q95 83 93 91M121.2 69.7Q130 82 131 103')+
      D.path('M35 89L45 103L65 106M124 90L114 104L96 106')+
      D.rect(72,66,18,40,1,D.paper)+D.rect(76,70,10,11,1)+D.rect(76,86,10,12,1)+
      D.path('M77 78L80 75L85 78M78 94L82 90L86 94')+
      D.path('M68 88L72 84L76 88L73 94M94 89L91 85L87 89L90 95')+
      D.path('M43 109L51 101H112L120 109L115 128H48ZM44 110H119M72 116H91',{fill:D.paper})+
      D.head(51,55,.67,{facing:'right',hair:'short',tilt:6})+
      D.head(111,56,.67,{facing:'left',hair:'long',tilt:-6})),
    scene('duo-completed-500','the-grand-dance','rosette','peach',D=>
      D.path('M49.4 67.8Q40 79 39 99Q48 109 57 112Q65 114 71 110Q76 99 76 84M58.7 71.9Q72 65 79 46M48 84Q48 96 56 101L78 108')+
      D.path('M99.3 71.9Q90 63 84 43M110.2 69Q109 92 119 117Q109 128 96 130Q78 119 78 103Q79 90 84 82')+
      D.path('M58 112Q55 121 49 129Q55 131 60 130M70 111Q72 121 76 127L85 130M102 77Q94 89 77 95M80 46L78 39Q79 33 83 34L87 42L84 47')+
      D.path('M78 104L84 108L87 104M92 114Q102 117 112 116')+
      D.head(59,55,.7,{facing:'right',hair:'short',tilt:8})+
      D.head(99,55,.7,{facing:'left',hair:'long',tilt:-8})),
    scene('duo-distinct-categories-2','opening-a-new-view','shield','sage',D=>
      D.path('M31 127V34H130V127M33 37Q52 55 38 86L31 89M128 37Q110 56 124 86L131 89M36 85L31 116M126 85L131 116')+
      D.path('M48 64Q80 49 113 64M81 37V57')+
      D.path('M56.3 79.2Q46 87 42 109L48 130H76L77 95Q73 86 64.8 81.6',{fill:D.paper})+
      D.path('M95.2 81.6Q80 93 82 128H112L118 110Q115 89 104.9 80.4',{fill:D.paper})+
      D.path('M53 93L43 89L39 78M108 93L120 87L124 77M38 77L35 73M40 79L44 77M124 76L127 72M122 80L118 78')+
      D.head(63,67,.61,{facing:'right',hair:'short',tilt:0})+
      D.head(97,67,.61,{facing:'left',hair:'long',tilt:0})),
    scene('duo-distinct-categories-4','planning-the-whole-journey','circle','ivory',D=>
      D.path('M37.5 73.3Q29 87 28 107M45.8 77Q55 81 62 90L70 96M113.8 75Q104 80 97 87L89 96M123.3 72Q131 87 132 107')+
      D.path('M35 93L45 107M124 94L116 107M49 115L44 130M113 115L119 130')+
      D.ellipse(81,108,43,11,D.paper)+
      D.path('M47 96L70 91L88 97L114 92L111 113L88 117L70 112L50 116ZM70 92V112M88 98V116',{fill:D.paper})+
      D.path('M57 106Q63 99 72 103T98 105M68 96L74 100M93 95L87 102')+
      D.head(46,62,.62,{facing:'right',hair:'short',tilt:8})+
      D.head(113,60,.62,{facing:'left',hair:'long',tilt:-10})),
    scene('duo-distinct-cards-6','meeting-at-the-crossroads','hex','peach',D=>
      D.path('M44.2 64.4Q36 72 34 85Q34 97 39 108Q48 111 59 109L67 85M52.9 66.9Q62 70 72 77L80 72M109.1 65.9Q100 70 91 77L84 72M119.1 64.6Q128 75 129 86Q128 99 123 110H103L96 86')+
      D.path('M40 109Q38 119 34 128L43 130M57 110Q62 121 70 126L78 128M105 111Q100 121 90 127L82 129M123 110Q124 119 127 130M80 73L77 67L80 62L84 66L85 73')+
      D.path('M28 131Q49 119 76 120M132 131Q110 120 85 120')+
      D.head(51,52,.62,{facing:'right',hair:'short',tilt:0})+
      D.head(111,51,.62,{facing:'left',hair:'long',tilt:0})),
    scene('duo-distinct-cards-12','choosing-a-new-card','oval','ivory',D=>
      D.path('M43.8 70.7Q31 82 28 124M52.9 73.9Q63 79 68 89M106.1 74.9Q98 81 93 90M116.6 72.9Q127 82 132 124')+
      D.path('M38 91L47 110L68 110M120 91L111 108L96 109')+
      D.group(D.rect(65,82,21,30,2,D.paper),'rotate(-23 80 111)')+
      D.group(D.rect(75,82,21,30,2,D.paper),'rotate(23 80 111)')+
      D.rect(70,79,21,32,2,D.paper)+D.circle(80.5,93,4)+
      D.path('M69 109L75 104L82 107L86 112M97 94L91 91L87 94M94 97L91 96')+
      D.head(52,58,.66,{facing:'right',hair:'short',tilt:4})+
      D.head(107,59,.66,{facing:'left',hair:'long',tilt:-4})),
    scene('duo-distinct-cards-24','building-a-house-of-cards','rosette','sage',D=>
      D.path('M35.3 74Q28 88 28 113M44 77.7Q53 81 60 88L72 79M116 77.7Q105 80 98 87L88 78M126.1 75.2Q132 88 132 114')+
      D.path('M35 94L47 109M125 94L114 109M29 121H132M43 122V131M119 122V131')+
      D.path('M51 118L63 96L75 118ZM83 118L97 95L110 118ZM63 94H98M68 94L80 71L93 94Z',{fill:D.paper})+
      D.path('M58 116L64 102M89 116L97 101M75 92L81 78M70 80L74 76L78 79M91 79L87 75L83 78')+
      D.head(44,62,.65,{facing:'right',hair:'short',tilt:7})+
      D.head(116,62,.65,{facing:'left',hair:'long',tilt:-7})),
    scene('duo-distinct-variants-12','painting-together','shield','rose',D=>
      D.path('M42.8 71.7Q30 84 29 128M51.9 74.9Q61 79 65 86M108.7 79Q93 91 92 114M119.1 76.5Q128 86 132 127')+
      D.path('M37 94L48 107L66 100M123 92L116 105L105 108')+
      D.path('M72 109L66 131M96 109L108 131')+
      D.rect(67,62,37,47,2,D.paper)+
      D.path('M78 97Q75 83 86 80Q95 82 91 90Q81 93 78 97M85 81V74M84 97L87 103M60 99L72 92L81 84M67 95L70 99')+
      D.ellipse(115,109,10,7,D.paper)+D.circle(110,108,2)+
      D.head(51,59,.66,{facing:'right',hair:'short',tilt:4})+
      D.head(109,63,.66,{facing:'left',hair:'long',tilt:-6})),
    scene('duo-distinct-variants-36','packing-for-a-new-adventure','hex','sage',D=>
      D.path('M48.6 64.7Q35 80 32 107M57.2 68.9Q68 74 73 83M104.8 69.9Q94 75 89 85M115 66.8Q126 81 129 107')+
      D.path('M49 101L55 74H109L117 101Z',{fill:D.paper})+
      D.path('M67 88L70 82L77 79L82 84L88 80L98 86L94 94L89 91V102H75V91L70 95Z',{fill:D.paper})+
      D.rect(43,101,78,28,5,D.paper)+D.path('M44 109H120M73 103V100Q82 95 91 100V103M53 119V125M110 119V125')+
      D.path('M40 88L57 98L68 94M120 89L108 98L98 94M67 94L71 90L75 94M98 94L94 90L90 94')+
      D.head(58,53,.66,{facing:'right',hair:'short',tilt:10})+
      D.head(104,54,.66,{facing:'left',hair:'long',tilt:-10})),
    scene('duo-distinct-variants-72','a-piano-duet','oval','ivory',D=>
      D.path('M46.7 67.3Q34 79 35 106L58 113M55.6 70.7Q65 77 70 87L79 99M83.1 69.3Q73 80 74 107L96 113M93.3 71.7Q105 79 111 88L119 99')+
      D.path('M43 90L58 103L72 105M81 90L96 103L110 105M37 119H107M47 120L45 130M99 120L103 130')+
      D.rect(32,103,99,13,1,D.paper)+D.path('M39 104V114M48 104V114M57 104V114M66 104V114M75 104V114M84 104V114M93 104V114M102 104V114M111 104V114M120 104V114M33 116V131M130 116V131')+
      D.path('M69 104L72 100L77 102M108 104L112 99L118 101')+
      D.head(55,55,.65,{facing:'right',hair:'short',tilt:5})+
      D.head(93,56,.65,{facing:'right',hair:'long',tilt:6})),
    scene('duo-completion-days-3','the-welcoming-doorway','shield','peach',D=>
      D.path('M83 131V33H131V131M85 36L95 43V130M84 113H90')+
      D.path('M40.9 76Q29 84 28 112Q38 117 55 115M50 79Q59 84 60 98M119.5 76Q130 82 131 111M109 78Q99 82 95 99')+
      D.path('M37 91Q44 101 53 104Q66 103 75 96M52 88Q65 84 74 71M72 72Q74 66 78 65L80 68L78 74M106 89Q101 99 87 103Q82 104 77 100')+
      D.path('M76 100L81 95L87 97M33 115Q31 123 29 131M51 116Q55 124 62 130M105 112L105 131M122 111L128 131')+
      D.head(48,63,.65,{facing:'right',hair:'short'})+
      D.head(111,62,.65,{facing:'left',hair:'long'})),
    scene('duo-completion-days-10','a-table-for-two','oval','ivory',D=>
      D.circle(80,45,11)+D.path('M80 38V45L85 48')+
      D.path('M41 72Q29 80 29 104Q31 115 52 116M50 74Q60 79 64 91M120 73Q132 80 132 105Q130 115 109 116M110 74Q100 79 96 91')+
      D.path('M38 89Q44 99 57 101M123 89Q117 99 104 101M49 115Q57 119 57 131M110 116Q104 122 104 131')+
      D.ellipse(80,105,34,8,D.paper)+D.path('M80 113V130M65 131H95')+
      D.path('M60 94H70V101Q65 105 60 101ZM70 96Q78 94 76 99Q74 101 70 100M91 94H101V101Q96 105 91 101ZM101 96Q109 94 107 99Q105 101 101 100',{fill:D.paper})+
      D.path('M61 88Q58 85 61 82M96 88Q93 85 96 82')+
      D.head(48,59,.64,{facing:'right',hair:'short'})+
      D.head(112,59,.64,{facing:'left',hair:'long'})),
    scene('duo-completion-days-30','saving-the-next-date','circle','sage',D=>
      D.rect(58,42,44,53,3,D.paper)+D.path('M58 55H102M68 37V47M92 37V47M69 63H75V69H69ZM85 63H91V69H85ZM69 78H75V84H69ZM85 78L89 83L96 75')+
      D.path('M36.4 85Q28 94 28 126M44.8 87Q56 94 59 110M125.4 85Q132 96 132 126M116.3 87Q105 95 102 110')+
      D.path('M37 99Q43 91 49 74Q51 65 58 60M57 60L58 55L63 56L63 62M122 100Q116 88 110 74Q107 65 102 60M103 60L102 55L97 56L97 62')+
      D.path('M36 112L40 131M122 112L118 131')+
      D.head(43,73,.6,{facing:'right',hair:'short'})+
      D.head(118,73,.57,{facing:'left',hair:'long'})),
    scene('duo-completion-streak-3','helping-up-the-next-step','hex','peach',D=>
      D.path('M28 131H53V120H79V108H106V96H132')+
      D.path('M48.4 74Q37 81 36 99Q45 105 61 104M56.8 76Q67 81 74 78Q80 75 83 69M101.8 57Q114 63 115 84Q102 91 87 87M92.2 58Q84 62 80 73')+
      D.path('M45 90Q52 95 63 89L78 77M78 77Q81 74 85 75L88 79M46 105Q44 112 42 119M59 104Q68 105 72 108L73 119M96 88Q93 96 91 106M110 86Q117 87 122 93L122 95')+
      D.head(55,62,.6,{facing:'right',hair:'short'})+
      D.head(94,44,.6,{facing:'left',hair:'long'})),
    scene('duo-completion-streak-7','riding-in-tandem','oval','sage',D=>
      D.circle(43,113,15)+D.circle(117,113,15)+
      D.path('M43 113L57 88L73 113ZM73 113L88 88L99 113ZM57 88H88M88 88L105 79L117 113M105 79L110 72H119M50 86H62M82 86H94M73 113H82')+
      D.path('M50.5 62Q42 70 45 80L60 87M57.5 64Q67 67 73 77L84 78M89.5 62Q80 69 82 80L96 87M97.5 64Q107 67 112 75')+
      D.path('M53 75Q61 78 69 78M93 75Q102 78 112 77M59 87Q67 88 71 96L63 105M95 87Q102 90 103 99L95 108M47 82Q43 88 46 95L54 101M83 82Q78 88 81 95L89 101')+
      D.head(56,52,.5,{facing:'right',hair:'short'})+
      D.head(96,51,.5,{facing:'right',hair:'long'})),
    scene('duo-weekend-completed-5','an-afternoon-picnic','shield','peach',D=>
      D.path('M29 108L112 101L132 126L40 131ZM44 110L54 129M111 106L125 123')+
      D.path('M47.9 73Q35 81 36 99Q44 105 64 103M57 75.6Q67 82 69 94M111.5 74.3Q125 83 123 99Q116 107 96 103M101 75.6Q91 82 89 95')+
      D.path('M43 88Q52 97 66 97M117 89Q108 97 95 97M46 103Q38 111 48 119Q56 124 69 121M108 105Q124 110 118 119Q111 125 96 122')+
      D.path('M66 111Q65 99 80 99Q94 99 95 111M64 111H97L93 126H68Z',{fill:D.paper})+
      D.path('M68 117H93M72 112V124M81 112V125M89 112V124')+
      D.head(55,60,.65,{facing:'right',hair:'short'})+
      D.head(103,60,.65,{facing:'left',hair:'long'})),
    scene('duo-weekend-completed-20','sunday-on-the-sofa','rosette','ivory',D=>
      D.path('M33 113V85Q33 78 41 78H119Q127 78 127 85V113M35 122V131M125 122V131')+
      D.path('M54.9 73Q44 80 42 99L61 110M64 76Q73 81 77 92M107.8 78Q119 85 119 101L101 112M98.2 79Q88 82 85 92')+
      D.path('M50 90Q58 101 72 102M112 93Q103 101 91 103M55 108Q54 116 63 122M105 110Q111 116 120 121')+
      D.path('M59 91Q71 88 81 95Q92 88 105 91L102 111Q92 108 81 114Q69 107 63 111Z',{fill:D.paper})+
      D.path('M81 95V113M67 98L75 100M89 100L99 97')+
      D.path('M28 102Q28 98 32 98H37Q42 98 42 104V115H118V104Q118 98 123 98H128Q132 98 132 102V123H28Z',{fill:D.paper})+
      D.head(62,60,.65,{facing:'right',hair:'short'})+
      D.head(100,64,.6,{facing:'left',hair:'long'})),
    scene('duo-every-category-5','the-road-trip','hex','sage',D=>
      D.path('M34 93L41 58Q80 39 120 58L127 93M43 61Q80 46 118 61L123 94H38Z')+
      D.path('M57.9 80Q47 84 46 95H75Q73 84 64.4 81M107.2 80Q118 85 119 95H90Q91 84 99.6 81',{fill:D.paper})+
      D.head(63,70,.46,{facing:'right',hair:'short'})+
      D.head(101,70,.48,{facing:'left',hair:'long'})+
      D.circle(62,94,10)+D.path('M53 93H71M62 95V102')+
      D.path('M29 97Q80 89 131 97V121H29ZM36 121V131H49V122M111 122V131H124V121',{fill:D.paper})+
      D.rect(35,102,18,9,4)+D.rect(107,102,18,9,4)+D.path('M64 109H96M66 115H94')+
      D.path('M80 61V70M76 61H84')),
    scene('duo-thigh-massage-3','gentle-hands-above-the-knee','oval','peach',D=>
      D.path('M41.7 69.2Q29 76 29 102Q39 109 57 109M51 71.8Q64 77 70 90M112.1 71.4Q125 79 129 102M100.9 72.8Q90 78 86 96')+
      D.path('M84 96Q105 94 126 105L121 117Q99 113 80 117L72 106Z',{fill:D.paper})+
      D.path('M91 97L87 113M120 116Q109 124 89 124L67 125M80 116Q71 122 60 121M35 111Q46 116 51 130M121 121L128 131M28 132H132')+
      D.path('M39 85Q49 97 63 101L82 104Q87 104 88 109L83 112L75 109L60 110Q47 108 40 103',{fill:D.paper})+
      D.path('M61 84Q67 94 81 97L94 102Q98 104 95 108L90 108L81 103M77 105L83 108M83 101L90 105')+
      D.head(49,56,.66,{facing:'right',hair:'short'})+
      D.head(103,56,.7,{facing:'left',hair:'long'})),
    scene('duo-covered-face-3','a-face-in-petals','circle','rose',D=>
      D.path('M68.3 73.8Q49 97 42 131M82.7 75.6Q104 100 112 131M57 112Q65 120 78 124')+
      D.head(80,54,.9,{facing:'right',hair:'long'})+
      D.path('M89 64Q86 45 103 39Q112 56 95 68M96 68Q110 52 122 61Q119 77 100 75M95 75Q106 79 103 94Q86 92 88 77M88 73Q71 81 64 69Q73 57 88 65',{fill:D.paper})+
      D.path('M96 69Q101 57 105 52M99 72L112 67M93 77L98 87M88 68L74 68')+
      D.path('M83 78Q79 91 84 105M62 109Q69 101 79 101L86 104L85 109L78 110M78 104L82 106')),
    scene('duo-kind-note-3','a-small-note-a-big-smile','shield','ivory',D=>
      D.path('M39 131V37H79M76 37V77')+
      D.path('M51.2 77Q42 86 42 109M60.2 79Q70 82 75 95M116.4 79Q130 86 132 128M105.4 80Q94 88 91 103')+
      D.path('M50 91Q59 98 70 95M123 98Q116 111 105 114M96 96Q88 102 85 110')+
      D.path('M75 92L99 89L105 115L80 119Z',{fill:D.paper})+
      D.path('M82 99Q83 95 87 99Q90 94 93 97Q97 101 88 107Q84 104 82 99M85 113L98 111M79 109L75 112L80 116M104 105L108 109L104 114')+
      D.head(58,65,.62,{facing:'right',hair:'short'})+
      D.head(108,65,.65,{facing:'left',hair:'long'})),
    scene('duo-crepes-3','the-pancake-kitchen','hex','ivory',D=>
      D.path('M40.4 75.8Q29 82 28 113M50.1 78.6Q60 82 66 96M119.6 78.3Q131 83 132 114M107.8 79.8Q98 84 95 98')+
      D.path('M38 92Q46 104 60 105L74 101M123 94Q116 103 102 105M29 121H131M39 122V132M121 122V132')+
      D.path('M47 119L50 86M113 119L111 86M50 93Q58 98 62 110M111 93Q102 98 98 110')+
      D.path('M68 99Q81 105 96 96Q92 109 77 108ZM68 101L59 107',{fill:D.paper})+
      D.ellipse(85,77,13,3,D.paper)+D.path('M75 84Q70 80 72 75M98 86Q102 81 101 75')+
      D.path('M104 110H128Q126 120 116 120Q106 120 104 110ZM118 109L123 96',{fill:D.paper})+
      D.head(48,62,.69,{facing:'right',hair:'short'})+
      D.head(110,62,.74,{facing:'left',hair:'long'})),
    scene('duo-forest-walk-3','walking-among-the-trees','oval','sage',D=>
      D.path('M32 94V43M32 65Q45 63 45 51Q34 50 32 59M32 50Q27 45 29 34M127 94V42M127 63Q114 62 114 49Q125 49 127 59M127 49Q132 44 130 33')+
      D.path('M53.4 68Q42 75 43 96L64 100M61.8 70Q68 76 72 88M108.8 69Q118 77 117 98L96 101M99.2 70Q91 77 86 89')+
      D.path('M53 84Q65 91 76 96M105 84Q94 92 83 97M75 96Q80 93 85 96L86 100L81 102L75 99M50 98Q46 111 42 125L51 129M64 100Q67 112 75 120M99 101Q96 115 89 129M115 99Q119 113 123 124L131 126')+
      D.path('M28 131Q44 115 62 112M132 132Q117 121 105 118')+
      D.head(60,56,.6,{facing:'right',hair:'short'})+
      D.head(101,56,.6,{facing:'left',hair:'long'})),
    scene('duo-phone-drawer-3','closing-the-phone-drawer','shield','rose',D=>
      D.path('M43.6 72.4Q31 80 28 109M53 75.1Q66 79 71 94M116.5 73.3Q129 82 132 109M106 74.6Q95 80 90 94')+
      D.path('M31 109H129V131M40 109L48 100H113L121 109')+
      D.path('M44 110H117L113 130H48ZM73 119H89',{fill:D.paper})+
      D.group(D.rect(72,90,14,24,3,D.paper)+D.path('M77 110H81'),'rotate(-18 79 102)')+
      D.path('M38 89Q45 100 61 102L72 101M124 91Q116 101 103 103L90 102M71 101L75 96L80 98M90 102L86 98L82 100M48 112Q58 116 67 115M112 112Q102 116 93 115')+
      D.head(51,59,.67,{facing:'right',hair:'short'})+
      D.head(108,59,.65,{facing:'left',hair:'long'}))
  ]);
  scope.OndeBadgeScenesShared=scenes;
  if(typeof module!=='undefined'&&module.exports)module.exports=scenes;
})(typeof window!=='undefined'?window:globalThis);
