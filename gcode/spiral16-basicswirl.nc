G17 (select the xy plane)
M03 (pen down)
G4 P5000 (wait 5000ms)
M05 (pen up)
G4 P2000 (wait 2000ms)
(toolDiameter=0.15)
G93 (inverse time mode)
G1 Z0 F2000 X2 Y0
G1 Z0 F2000 X2 Y2
G1 Z0 F2000 X0 Y2
G1 Z0 F2000 X0 Y0
G0 F279000 X279 Y0
G4 P279 (wait 279ms)
M03 (pen down)
G4 P500 (wait 500ms)
G1 Z0 F2000 X281 Y0
G1 Z0 F2000 X281 Y2
G1 Z0 F2000 X279 Y2
G1 Z0 F2000 X279 Y0
M05 (pen up)
G4 P250 (wait 250ms)
G0 F192000 X279 Y192
G4 P192 (wait 192ms)
M03 (pen down)
G4 P500 (wait 500ms)
G1 Z0 F2000 X281 Y192
G1 Z0 F2000 X281 Y194
G1 Z0 F2000 X279 Y194
G1 Z0 F2000 X279 Y192
M05 (pen up)
G4 P250 (wait 250ms)
G0 F279000 X0 Y192
G4 P279 (wait 279ms)
M03 (pen down)
G4 P500 (wait 500ms)
G1 Z0 F2000 X2 Y192
G1 Z0 F2000 X2 Y194
G1 Z0 F2000 X0 Y194
G1 Z0 F2000 X0 Y192
M05 (pen up)
G4 P250 (wait 250ms)
G0 F169603.21341 X140.5 Y97
G4 P170 (wait 170ms)
M03 (pen down)
G4 P500 (wait 500ms)
G1 Z0 F138 X140.62282 Y97.06291
G1 Z0 F138.04116 X140.74344 Y97.13005
G1 Z0 F138.16632 X140.86117 Y97.20236
G1 Z0 F138.4304 X140.97528 Y97.28073
G1 Z0 F138.89951 X141.08494 Y97.36599
G1 Z0 F139.64931 X141.18921 Y97.45888
G1 Z0 F140.7629 X141.28708 Y97.56006
G1 Z0 F142.32784 X141.37742 Y97.67003
G1 Z0 F144.43257 X141.45901 Y97.78921
G1 Z0 F147.16231 X141.53053 Y97.91783
G1 Z0 F150.59496 X141.59055 Y98.05595
G1 Z0 F154.79717 X141.63759 Y98.20343
G1 Z0 F159.82136 X141.67008 Y98.35991
G1 Z0 F165.70376 X141.68642 Y98.52481
G1 Z0 F172.46383 X141.68499 Y98.69726
G1 Z0 F180.10482 X141.66417 Y98.87616
G1 Z0 F188.61538 X141.62238 Y99.06009
G1 Z0 F197.97167 X141.55815 Y99.24735
G1 Z0 F208.13987 X141.47008 Y99.43594
G1 Z0 F219.0785 X141.357 Y99.62358
G1 Z0 F230.74057 X141.21789 Y99.80767
G1 Z0 F243.07536 X141.05205 Y99.98539
G1 Z0 F256.02983 X140.85906 Y100.15363
G1 Z0 F269.54968 X140.63886 Y100.30909
G1 Z0 F283.58008 X140.3918 Y100.4483
G1 Z0 F298.06621 X140.11868 Y100.56768
G1 Z0 F312.95355 X139.82078 Y100.66357
G1 Z0 F328.18814 X139.49988 Y100.73232
G1 Z0 F343.71661 X139.15827 Y100.77038
G1 Z0 F359.48628 X138.79881 Y100.77433
G1 Z0 F375.44516 X138.42485 Y100.74099
G1 Z0 F391.54189 X138.04026 Y100.66752
G1 Z0 F407.72578 X137.6494 Y100.55147
G1 Z0 F423.94674 X137.25704 Y100.39088
G1 Z0 F440.15528 X136.86835 Y100.18434
G1 Z0 F456.30249 X136.48879 Y99.93108
G1 Z0 F472.34002 X136.12403 Y99.63099
G1 Z0 F488.22007 X135.77987 Y99.28471
G1 Z0 F503.89543 X135.46213 Y98.89362
G1 Z0 F519.31946 X135.17654 Y98.45987
G1 Z0 F534.44614 X134.92865 Y97.9864
G1 Z0 F549.23008 X134.72365 Y97.47686
G1 Z0 F563.62652 X134.56635 Y96.93562
G1 Z0 F577.59145 X134.46101 Y96.36772
G1 Z0 F591.08158 X134.41127 Y95.77874
G1 Z0 F604.05442 X134.42007 Y95.17474
G1 Z0 F616.46831 X134.48956 Y94.56221
G1 Z0 F628.28251 X134.62108 Y93.94784
G1 Z0 F639.4572 X134.81509 Y93.33853
G1 Z0 F649.95359 X135.07117 Y92.74115
G1 Z0 F659.73394 X135.38805 Y92.1625
G1 Z0 F668.76165 X135.76359 Y91.60914
G1 Z0 F677.00128 X136.19486 Y91.08727
G1 Z0 F684.41868 X136.67817 Y90.60267
G1 Z0 F690.98095 X137.20916 Y90.16052
G1 Z0 F696.65662 X137.78293 Y89.76539
G1 Z0 F701.41561 X138.39406 Y89.42115
G1 Z0 F705.22935 X139.03678 Y89.13088
G1 Z0 F708.07081 X139.70508 Y88.8969
G1 Z0 F709.91461 X140.39278 Y88.72069
G1 Z0 F710.73701 X141.09369 Y88.60296
G1 Z0 F710.51603 X141.80173 Y88.5436
G1 Z0 F709.23149 X142.51096 Y88.54177
G1 Z0 F706.86507 X143.21575 Y88.5959
G1 Z0 F703.40038 X143.91082 Y88.70378
G1 Z0 F698.82303 X144.59135 Y88.86265
G1 Z0 F693.12066 X145.25298 Y89.06919
G1 Z0 F686.28306 X145.8919 Y89.31971
G1 Z0 F678.30221 X146.50488 Y89.61015
G1 Z0 F669.17238 X147.08925 Y89.93619
G1 Z0 F658.89019 X147.64294 Y90.29335
G1 Z0 F647.45474 X148.16447 Y90.67703
G1 Z0 F634.86768 X148.6529 Y91.0826
G1 Z0 F621.1334 X149.10785 Y91.50548
G1 Z0 F606.25911 X149.52943 Y91.94116
G1 Z0 F590.25512 X149.91821 Y92.3853
G1 Z0 F573.13498 X150.27516 Y92.8337
G1 Z0 F554.91589 X150.60164 Y93.28241
G1 Z0 F535.61901 X150.89931 Y93.7277
G1 Z0 F515.27004 X151.17008 Y94.16609
G1 Z0 F493.89987 X151.41607 Y94.59437
G1 Z0 F471.54561 X151.63957 Y95.00959
G1 Z0 F448.25185 X151.84297 Y95.40904
G1 Z0 F424.07263 X152.0287 Y95.79027
G1 Z0 F399.07412 X152.19924 Y96.15107
G1 Z0 F373.33867 X152.35701 Y96.48944
G1 Z0 F346.97094 X152.50439 Y96.80355
G1 Z0 F320.10724 X152.64365 Y97.09178
G1 Z0 F292.93033 X152.77694 Y97.35263
G1 Z0 F265.69328 X152.90623 Y97.58474
G1 Z0 F238.75856 X153.03332 Y97.78686
G1 Z0 F212.66211 X153.15982 Y97.95781
G1 Z0 F188.21552 X153.28707 Y98.09649
G1 Z0 F166.65086 X153.41621 Y98.20183
G1 Z0 F149.75605 X153.54807 Y98.27283
G1 Z0 F139.78079 X153.68322 Y98.30848
G1 Z0 F138.73803 X153.82196 Y98.30781
G1 Z0 F147.25701 X153.96425 Y98.26988
G1 Z0 F164.20848 X154.10975 Y98.19376
G1 Z0 F187.59187 X154.25779 Y98.07854
G1 Z0 F215.52727 X154.40738 Y97.92338
G1 Z0 F246.61981 X154.55719 Y97.72748
G1 Z0 F279.92016 X154.70555 Y97.49011
G1 Z0 F314.79091 X154.85045 Y97.21065
G1 Z0 F350.79462 X154.98957 Y96.88862
G1 Z0 F387.61947 X155.12024 Y96.52369
G1 Z0 F425.03307 X155.2395 Y96.11573
G1 Z0 F462.8541 X155.34408 Y95.66485
G1 Z0 F500.93487 X155.43044 Y95.17141
G1 Z0 F539.15027 X155.49481 Y94.63612
G1 Z0 F577.39069 X155.53322 Y94.06001
G1 Z0 F615.55743 X155.54149 Y93.44451
G1 Z0 F653.55956 X155.51536 Y92.79147
G1 Z0 F691.31188 X155.45049 Y92.10321
G1 Z0 F728.73341 X155.34253 Y91.38251
G1 Z0 F765.74648 X155.18719 Y90.63269
G1 Z0 F802.27592 X154.98029 Y89.85755
G1 Z0 F838.24869 X154.71787 Y89.06144
G1 Z0 F873.59344 X154.39625 Y88.2492
G1 Z0 F908.24032 X154.01208 Y87.42621
G1 Z0 F942.12085 X153.56246 Y86.5983
G1 Z0 F975.16777 X153.04501 Y85.77175
G1 Z0 F1007.31502 X152.45791 Y84.95321
G1 Z0 F1038.49769 X151.80001 Y84.14969
G1 Z0 F1068.65205 X151.07086 Y83.36844
G1 Z0 F1097.71556 X150.27078 Y82.61687
G1 Z0 F1125.62689 X149.4009 Y81.90249
G1 Z0 F1152.32598 X148.46316 Y81.23279
G1 Z0 F1177.7541 X147.46037 Y80.61511
G1 Z0 F1201.85388 X146.39617 Y80.0566
G1 Z0 F1224.56941 X145.27504 Y79.56403
G1 Z0 F1245.84628 X144.10223 Y79.14372
G1 Z0 F1265.63169 X142.88376 Y78.80146
G1 Z0 F1283.87447 X141.6263 Y78.54233
G1 Z0 F1300.52518 X140.33715 Y78.37071
G1 Z0 F1315.53623 X139.02409 Y78.29012
G1 Z0 F1328.86185 X137.69529 Y78.3032
G1 Z0 F1340.45828 X136.35922 Y78.41162
G1 Z0 F1350.28376 X135.02451 Y78.61609
G1 Z0 F1358.29865 X133.69981 Y78.91631
G1 Z0 F1364.46549 X132.39367 Y79.31099
G1 Z0 F1368.74905 X131.11443 Y79.79784
G1 Z0 F1371.11645 X129.87008 Y80.37365
G1 Z0 F1371.53718 X128.66814 Y81.0343
G1 Z0 F1369.98319 X127.51557 Y81.77486
G1 Z0 F1366.42895 X126.41866 Y82.58967
G1 Z0 F1360.85153 X125.38294 Y83.47239
G1 Z0 F1353.23064 X124.41314 Y84.41617
G1 Z0 F1343.5487 X123.51313 Y85.41372
G1 Z0 F1331.79091 X122.68585 Y86.45741
G1 Z0 F1317.94531 X121.93337 Y87.53942
G1 Z0 F1302.00282 X121.2568 Y88.65183
G1 Z0 F1283.95733 X120.65636 Y89.78674
G1 Z0 F1263.80573 X120.1314 Y90.93636
G1 Z0 F1241.54802 X119.68043 Y92.09311
G1 Z0 F1217.18733 X119.30118 Y93.2497
G1 Z0 F1190.73002 X118.99066 Y94.39923
G1 Z0 F1162.18578 X118.74526 Y95.53522
G1 Z0 F1131.56769 X118.56077 Y96.65164
G1 Z0 F1098.89239 X118.43251 Y97.74302
G1 Z0 F1064.18018 X118.35539 Y98.80441
G1 Z0 F1027.45524 X118.32402 Y99.83138
G1 Z0 F988.74585 X118.33275 Y100.82009
G1 Z0 F948.08476 X118.37578 Y101.7672
G1 Z0 F905.50956 X118.44722 Y102.66988
G1 Z0 F861.06338 X118.54117 Y103.52581
G1 Z0 F814.79574 X118.65179 Y104.33306
G1 Z0 F766.76385 X118.77334 Y105.09013
G1 Z0 F717.03458 X118.90026 Y105.79584
G1 Z0 F665.68744 X119.02718 Y106.44932
G1 Z0 F612.81941 X119.149 Y107.0499
G1 Z0 F558.5528 X119.26092 Y107.59713
G1 Z0 F503.04896 X119.35844 Y108.09064
G1 Z0 F446.5329 X119.43742 Y108.53013
G1 Z0 F389.34078 X119.4941 Y108.91532
G1 Z0 F332.01737 X119.52513 Y109.24588
G1 Z0 F275.53242 X119.52755 Y109.52141
G1 Z0 F221.79802 X119.49885 Y109.74134
G1 Z0 F174.93732 X119.43699 Y109.90498
G1 Z0 F143.72917 X119.34039 Y110.01141
G1 Z0 F140.87242 X119.20799 Y110.05951
G1 Z0 F169.16913 X119.03922 Y110.04792
G1 Z0 F217.70916 X118.83407 Y109.97505
G1 Z0 F276.70294 X118.59309 Y109.83905
G1 Z0 F341.26497 X118.31745 Y109.63785
G1 Z0 F409.13062 X118.0089 Y109.36917
G1 Z0 F479.16171 X117.66987 Y109.03057
G1 Z0 F550.71881 X117.30345 Y108.61943
G1 Z0 F623.40093 X116.91346 Y108.13309
G1 Z0 F696.92999 X116.50441 Y107.56882
G1 Z0 F771.09561 X116.08159 Y106.92399
G1 Z0 F845.72668 X115.65105 Y106.19606
G1 Z0 F920.67599 X115.21958 Y105.38274
G1 Z0 F995.81133 X114.79478 Y104.48208
G1 Z0 F1071.0103 X114.38498 Y103.49258
G1 Z0 F1146.15701 X113.99923 Y102.41328
G1 Z0 F1221.14005 X113.6473 Y101.24396
G1 Z0 F1295.85118 X113.33956 Y99.98518
G1 Z0 F1370.18445 X113.08692 Y98.63848
G1 Z0 F1444.03565 X112.90077 Y97.2065
G1 Z0 F1517.30195 X112.79281 Y95.69304
G1 Z0 F1589.88166 X112.77492 Y94.10326
G1 Z0 F1661.67409 X112.85901 Y92.44371
G1 Z0 F1732.57953 X113.05683 Y90.72247
G1 Z0 F1802.49915 X113.37976 Y88.94913
G1 Z0 F1871.33511 X113.83858 Y87.13491
G1 Z0 F1938.99053 X114.44326 Y85.29262
G1 Z0 F2005.36956 X115.20269 Y83.43661
G1 Z0 F2070.37749 X116.12442 Y81.58273
G1 Z0 F2133.92081 X117.21446 Y79.74822
G1 Z0 F2195.90729 X118.47697 Y77.95153
G1 Z0 F2256.24611 X119.91408 Y76.21218
G1 Z0 F2314.84793 X121.52567 Y74.55046
G1 Z0 F2371.62501 X123.30916 Y72.98721
G1 Z0 F2426.49134 X125.25943 Y71.54349
G1 Z0 F2479.36271 X127.36865 Y70.24025
G1 Z0 F2530.15684 X129.62626 Y69.09794
G1 Z0 F2578.7935 X132.019 Y68.13619
G1 Z0 F2625.19458 X134.53091 Y67.37333
G1 Z0 F2669.28426 X137.1435 Y66.82611
G1 Z0 F2710.98906 X139.83591 Y66.50923
G1 Z0 F2750.23797 X142.58515 Y66.43504
G1 Z0 F2786.96256 X145.36641 Y66.61321
G1 Z0 F2821.09708 X148.15342 Y67.05043
G1 Z0 F2852.57855 X150.91883 Y67.75021
G1 Z0 F2881.34686 X153.63467 Y68.71269
G1 Z0 F2907.34487 X156.27279 Y69.93457
G1 Z0 F2930.51852 X158.80536 Y71.40904
G1 Z0 F2950.81688 X161.20534 Y73.12584
G1 Z0 F2968.19226 X163.44698 Y75.0714
G1 Z0 F2982.60031 X165.50628 Y77.22899
G1 Z0 F2994.00005 X167.36138 Y79.57902
G1 Z0 F3002.354 X168.99298 Y82.09934
G1 Z0 F3007.62824 X170.38466 Y84.76562
G1 Z0 F3009.79243 X171.52315 Y87.55178
G1 Z0 F3008.81997 X172.39852 Y90.43045
G1 Z0 F3004.68795 X173.00431 Y93.37343
G1 Z0 F2997.37731 X173.33761 Y96.35222
G1 Z0 F2986.87281 X173.399 Y99.33846
G1 Z0 F2973.16315 X173.19247 Y102.30444
G1 Z0 F2956.24096 X172.72527 Y105.22353
G1 Z0 F2936.10286 X172.00769 Y108.0706
G1 Z0 F2912.74951 X171.05276 Y110.82237
G1 Z0 F2886.18562 X169.87595 Y113.45774
G1 Z0 F2856.41999 X168.4948 Y115.95805
G1 Z0 F2823.46551 X166.92854 Y118.30726
G1 Z0 F2787.33923 X165.19771 Y120.49209
G1 Z0 F2748.06232 X163.32377 Y122.50211
G1 Z0 F2705.6601 X161.32866 Y124.32972
G1 Z0 F2660.16205 X159.2345 Y125.97013
G1 Z0 F2611.60182 X157.06316 Y127.42125
G1 Z0 F2560.01719 X154.83601 Y128.68358
G1 Z0 F2505.45011 X152.57357 Y129.75998
G1 Z0 F2447.94667 X150.29531 Y130.65553
G1 Z0 F2387.5571 X148.01945 Y131.37723
G1 Z0 F2324.33573 X145.76273 Y131.93381
G1 Z0 F2258.34104 X143.54039 Y132.33544
G1 Z0 F2189.63557 X141.36601 Y132.59347
G1 Z0 F2118.28599 X139.25152 Y132.72019
G1 Z0 F2044.36306 X137.20717 Y132.72858
G1 Z0 F1967.94164 X135.2416 Y132.63209
G1 Z0 F1889.10077 X133.36185 Y132.44437
G1 Z0 F1807.92364 X131.57349 Y132.17914
G1 Z0 F1724.49778 X129.88069 Y131.84998
G1 Z0 F1638.91514 X128.28639 Y131.47017
G1 Z0 F1551.27237 X126.79238 Y131.05258
G1 Z0 F1461.67116 X125.39947 Y130.60955
G1 Z0 F1370.21882 X124.10763 Y130.15277
G1 Z0 F1277.02913 X122.91613 Y129.69328
G1 Z0 F1182.22372 X121.8237 Y129.24133
G1 Z0 F1085.93424 X120.82866 Y128.80643
G1 Z0 F988.30604 X119.92904 Y128.39724
G1 Z0 F889.50428 X119.12273 Y128.02164
G1 Z0 F789.72509 X118.40756 Y127.68667
G1 Z0 F689.21667 X117.78147 Y127.39853
G1 Z0 F588.32237 X117.24251 Y127.16264
G1 Z0 F487.57725 X116.789 Y126.98359
G1 Z0 F387.95182 X116.41956 Y126.86518
G1 Z0 F291.56969 X116.13317 Y126.81043
G1 Z0 F204.23956 X115.92924 Y126.82159
G1 Z0 F144.80446 X115.80759 Y126.90013
G1 Z0 F151.75054 X115.7685 Y127.04676
G1 Z0 F219.17036 X115.81273 Y127.26142
G1 Z0 F309.8732 X115.94149 Y127.54328
G1 Z0 F408.53845 X116.15639 Y127.89073
G1 Z0 F510.37957 X116.45947 Y128.30137
G1 Z0 F613.56636 X116.85313 Y128.77201
G1 Z0 F717.22455 X117.34004 Y129.29863
G1 Z0 F820.85056 X117.92311 Y129.87641
G1 Z0 F924.10663 X118.60541 Y130.49966
G1 Z0 F1026.73783 X119.39004 Y131.16189
G1 Z0 F1128.53429 X120.28007 Y131.85573
G1 Z0 F1229.31253 X121.27843 Y132.57302
G1 Z0 F1328.90551 X122.38775 Y133.30473
G1 Z0 F1427.15707 X123.61028 Y134.04108
G1 Z0 F1523.91867 X124.94774 Y134.7715
G1 Z0 F1619.04745 X126.40121 Y135.48475
G1 Z0 F1712.40503 X127.97099 Y136.16896
G1 Z0 F1803.85673 X129.65646 Y136.81168
G1 Z0 F1893.2712 X131.45598 Y137.40007
G1 Z0 F1980.52009 X133.36678 Y137.92093
G1 Z0 F2065.47793 X135.38485 Y138.3609
G1 Z0 F2148.02207 X137.50488 Y138.70659
G1 Z0 F2228.03266 X139.72014 Y138.94475
G1 Z0 F2305.39274 X142.02253 Y139.06245
G1 Z0 F2379.98821 X144.40247 Y139.04729
G1 Z0 F2451.70802 X146.84897 Y138.88757
G1 Z0 F2520.44417 X149.34964 Y138.57251
G1 Z0 F2586.09186 X151.89079 Y138.09246
G1 Z0 F2648.54962 X154.45748 Y137.43906
G1 Z0 F2707.71938 X157.03369 Y136.60545
G1 Z0 F2763.50659 X159.60246 Y135.58646
G1 Z0 F2815.82036 X162.14611 Y134.3787
G1 Z0 F2864.57359 X164.64641 Y132.98073
G1 Z0 F2909.68302 X167.08481 Y131.39315
G1 Z0 F2951.06942 X169.44275 Y129.61862
G1 Z0 F2988.65763 X171.70186 Y127.66197
G1 Z0 F3022.37673 X173.84426 Y125.53009
G1 Z0 F3052.16009 X175.85281 Y123.23196
G1 Z0 F3077.94552 X177.7114 Y120.77851
G1 Z0 F3099.67532 X179.40518 Y118.18254
G1 Z0 F3117.29642 X180.92081 Y115.4585
G1 Z0 F3130.76042 X182.24666 Y112.62234
G1 Z0 F3140.02371 X183.373 Y109.69128
G1 Z0 F3145.04754 X184.29214 Y106.68354
G1 Z0 F3145.79807 X184.99855 Y103.61808
G1 Z0 F3142.24649 X185.48895 Y100.51434
G1 Z0 F3134.36904 X185.7623 Y97.39191
G1 Z0 F3122.14707 X185.81987 Y94.2703
G1 Z0 F3105.56712 X185.6651 Y91.16859
G1 Z0 F3084.62097 X185.3036 Y88.10522
G1 Z0 F3059.30564 X184.74298 Y85.09772
G1 Z0 F3029.62349 X183.99273 Y82.16246
G1 Z0 F2995.58219 X183.06401 Y79.31448
G1 Z0 F2957.19479 X181.96948 Y76.5673
G1 Z0 F2914.47975 X180.72307 Y73.93279
G1 Z0 F2867.4609 X179.33975 Y71.42107
G1 Z0 F2816.16753 X177.83531 Y69.04043
G1 Z0 F2760.63436 X176.22609 Y66.79732
G1 Z0 F2700.90152 X174.52881 Y64.69634
G1 Z0 F2637.01461 X172.7603 Y62.74028
G1 Z0 F2569.02469 X170.93729 Y60.93015
G1 Z0 F2496.98824 X169.07628 Y59.26535
G1 Z0 F2420.96724 X167.1933 Y57.74368
G1 Z0 F2341.02911 X165.30381 Y56.36156
G1 Z0 F2257.24678 X163.42257 Y55.11412
G1 Z0 F2169.69875 X161.56353 Y53.99539
G1 Z0 F2078.46909 X159.73976 Y52.99845
G1 Z0 F1983.64763 X157.9634 Y52.11562
G1 Z0 F1885.33007 X156.24564 Y51.33858
G1 Z0 F1783.61831 X154.59671 Y50.65863
G1 Z0 F1678.62086 X153.0259 Y50.06675
G1 Z0 F1570.45346 X151.54157 Y49.55385
G1 Z0 F1459.24024 X150.1512 Y49.11083
G1 Z0 F1345.11535 X148.86147 Y48.72883
G1 Z0 F1228.22587 X147.67829 Y48.39925
G1 Z0 F1108.73675 X146.60688 Y48.11396
G1 Z0 F986.83977 X145.65187 Y47.86535
G1 Z0 F862.7708 X144.81733 Y47.64647
G1 Z0 F736.84558 X144.10685 Y47.4511
G1 Z0 F609.54193 X143.52365 Y47.27384
G1 Z0 F481.71538 X143.07059 Y47.11018
G1 Z0 F355.27982 X142.75024 Y46.95657
G1 Z0 F235.99045 X142.56492 Y46.81046
G1 Z0 F148.12795 X142.51673 Y46.67039
G1 Z0 F162.22091 X142.60757 Y46.53599
G1 Z0 F264.56856 X142.83915 Y46.40805
G1 Z0 F392.43292 X143.21293 Y46.28852
G1 Z0 F528.37845 X143.73017 Y46.18055
G1 Z0 F667.98612 X144.39178 Y46.08853
G1 Z0 F809.66204 X145.19837 Y46.01804
G1 Z0 F952.63847 X146.15007 Y45.97587
G1 Z0 F1096.45302 X147.24651 Y45.97004
G1 Z0 F1240.77599 X148.48665 Y46.00969
G1 Z0 F1385.34242 X149.86871 Y46.10511
G1 Z0 F1529.92184 X151.38997 Y46.26763
G1 Z0 F1674.30343 X153.04671 Y46.50956
G1 Z0 F1818.28825 X154.83396 Y46.84404
G1 Z0 F1961.68498 X156.74545 Y47.28497
G1 Z0 F2104.30741 X158.77337 Y47.8468
G1 Z0 F2245.97302 X160.90827 Y48.54437
G1 Z0 F2386.50214 X163.13891 Y49.39268
G1 Z0 F2525.71742 X165.45214 Y50.40669
G1 Z0 F2663.44362 X167.83281 Y51.60099
G1 Z0 F2799.50744 X170.26368 Y52.98955
G1 Z0 F2933.73751 X172.72543 Y54.58536
G1 Z0 F3065.96445 X175.19659 Y56.40016
G1 Z0 F3196.02091 X177.65367 Y58.44401
G1 Z0 F3323.74174 X180.0712 Y60.72498
G1 Z0 F3448.96407 X182.42191 Y63.24877
G1 Z0 F3571.52749 X184.67695 Y66.01835
G1 Z0 F3691.27419 X186.80616 Y69.03364
G1 Z0 F3808.04917 X188.77837 Y72.29119
G1 Z0 F3921.70034 X190.56187 Y75.78388
G1 Z0 F4032.07877 X192.12476 Y79.50073
G1 Z0 F4139.0388 X193.43553 Y83.42674
G1 Z0 F4242.43826 X194.46356 Y87.54274
G1 Z0 F4342.13861 X195.1797 Y91.82541
G1 Z0 F4438.00513 X195.55686 Y96.24736
G1 Z0 F4529.9071 X195.57061 Y100.77725
G1 Z0 F4617.71792 X195.19981 Y105.38006
G1 Z0 F4701.31534 X194.42711 Y110.01744
G1 Z0 F4780.58157 X193.23954 Y114.64817
G1 Z0 F4855.40345 X191.62897 Y119.22867
G1 Z0 F4925.67259 X189.5925 Y123.71365
G1 Z0 F4991.28555 X187.13276 Y128.05676
G1 Z0 F5052.14394 X184.25818 Y132.21138
G1 Z0 F5108.1546 X180.98301 Y136.1314
G1 Z0 F5159.2297 X177.32737 Y139.772
G1 Z0 F5205.28685 X173.31708 Y143.09052
G1 Z0 F5246.24929 X168.98337 Y146.04722
G1 Z0 F5282.04592 X164.36251 Y148.60606
G1 Z0 F5312.61148 X159.4953 Y150.73541
G1 Z0 F5337.8866 X154.42645 Y152.40866
G1 Z0 F5357.81795 X149.20384 Y153.60474
G1 Z0 F5372.35825 X143.87778 Y154.30854
G1 Z0 F5381.46645 X138.50014 Y154.51124
G1 Z0 F5385.10774 X133.12344 Y154.2104
G1 Z0 F5383.25363 X127.80001 Y153.41005
G1 Z0 F5375.88205 X122.58108 Y152.12054
G1 Z0 F5362.97735 X117.5159 Y150.3583
G1 Z0 F5344.5304 X112.65097 Y148.14551
G1 Z0 F5320.53861 X108.02929 Y145.50956
G1 Z0 F5291.00594 X103.68974 Y142.48251
G1 Z0 F5255.943 X99.66649 Y139.10044
G1 Z0 F5215.36697 X95.98863 Y135.40269
G1 Z0 F5169.3017 X92.6798 Y131.43112
G1 Z0 F5117.77768 X89.75806 Y127.22932
G1 Z0 F5060.83203 X87.23578 Y122.84183
G1 Z0 F4998.50848 X85.1197 Y118.31333
G1 Z0 F4930.85741 X83.41108 Y113.68797
G1 Z0 F4857.93576 X82.10599 Y109.00862
G1 Z0 F4779.80703 X81.1956 Y104.31631
G1 Z0 F4696.54122 X80.66664 Y99.64966
G1 Z0 F4608.21482 X80.50186 Y95.04439
G1 Z0 F4514.91071 X80.68055 Y90.53301
G1 Z0 F4416.71813 X81.17907 Y86.14452
G1 Z0 F4313.73261 X81.97143 Y81.90418
G1 Z0 F4206.05588 X83.02981 Y77.83347
G1 Z0 F4093.79578 X84.32513 Y73.95
G1 Z0 F3977.06623 X85.82755 Y70.26764
G1 Z0 F3855.98709 X87.50693 Y66.79657
G1 Z0 F3730.68406 X89.33331 Y63.54352
G1 Z0 F3601.28863 X91.27724 Y60.51195
G1 Z0 F3467.93797 X93.31015 Y57.70234
G1 Z0 F3330.77481 X95.40461 Y55.1125
G1 Z0 F3189.94741 X97.5346 Y52.73786
G1 Z0 F3045.60943 X99.67562 Y50.57181
G1 Z0 F2897.91995 X101.80486 Y48.60604
G1 Z0 F2747.04338 X103.90128 Y46.83085
G1 Z0 F2593.14957 X105.94561 Y45.23551
G1 Z0 F2436.4139 X107.9204 Y43.80851
G1 Z0 F2277.01752 X109.80994 Y42.5379
G1 Z0 F2115.14783 X111.60024 Y41.41154
G1 Z0 F1950.9993 X113.27892 Y40.41734
G1 Z0 F1784.7748 X114.83514 Y39.54351
G1 Z0 F1616.68802 X116.25949 Y38.77871
G1 Z0 F1446.96776 X117.54386 Y38.1123
G1 Z0 F1275.86583 X118.68135 Y37.53442
G1 Z0 F1103.67274 X119.66616 Y37.03617
G1 Z0 F930.75119 X120.49346 Y36.6097
G1 Z0 F757.61578 X121.15933 Y36.24832
G1 Z0 F585.15377 X121.66067 Y35.94656
G1 Z0 F415.38454 X121.99511 Y35.70019
G1 Z0 F255.1228 X122.16098 Y35.50635
G1 Z0 F142.93058 X122.15724 Y35.36347
G1 Z0 F196.63717 X121.98352 Y35.27134
G1 Z0 F345.82842 X121.64004 Y35.23112
G1 Z0 F512.564 X121.12767 Y35.24524
G1 Z0 F683.55028 X120.44795 Y35.31747
G1 Z0 F855.60502 X119.60311 Y35.45278
G1 Z0 F1027.51745 X118.59616 Y35.65735
G1 Z0 F1198.65094 X117.43094 Y35.93845
G1 Z0 F1368.58414 X116.11217 Y36.30434
G1 Z0 F1536.99132 X114.64559 Y36.7642
G1 Z0 F1703.59496 X113.03798 Y37.32797
G1 Z0 F1868.14446 X111.29731 Y38.00623
G1 Z0 F2030.40571 X109.43277 Y38.81
G1 Z0 F2190.15562 X107.45488 Y39.75059
G1 Z0 F2347.1791 X105.37553 Y40.83943
G1 Z0 F2501.26741 X103.20806 Y42.08779
G1 Z0 F2652.21718 X100.96727 Y43.50663
G1 Z0 F2799.82985 X98.66941 Y45.10629
G1 Z0 F2943.91144 X96.33223 Y46.89631
G1 Z0 F3084.2724 X93.97486 Y48.88517
G1 Z0 F3220.72762 X91.61779 Y51.08
G1 Z0 F3353.09647 X89.28271 Y53.48638
G1 Z0 F3481.20291 X86.99239 Y56.10807
G1 Z0 F3604.8756 X84.77052 Y58.9468
G1 Z0 F3723.94807 X82.64145 Y62.0021
G1 Z0 F3838.25887 X80.62996 Y65.27107
G1 Z0 F3947.65173 X78.76098 Y68.74826
G1 Z0 F4051.97573 X77.05929 Y72.42559
G1 Z0 F4151.08546 X75.54917 Y76.29225
G1 Z0 F4244.84125 X74.25407 Y80.33469
G1 Z0 F4333.10925 X73.19625 Y84.5367
G1 Z0 F4415.76165 X72.39643 Y88.87942
G1 Z0 F4492.67683 X71.87345 Y93.34156
G1 Z0 F4563.73953 X71.64388 Y97.89952
G1 Z0 F4628.84097 X71.72177 Y102.5277
G1 Z0 F4687.87901 X72.11837 Y107.19878
G1 Z0 F4740.75831 X72.84181 Y111.88401
G1 Z0 F4787.39042 X73.89701 Y116.55366
G1 Z0 F4827.69396 X75.28547 Y121.17739
G1 Z0 F4861.59468 X77.00519 Y125.72466
G1 Z0 F4889.02563 X79.05069 Y130.16521
G1 Z0 F4909.9272 X81.41297 Y134.46951
G1 Z0 F4924.24729 X84.07971 Y138.60916
G1 Z0 F4931.94133 X87.03537 Y142.55734
G1 Z0 F4932.97241 X90.2614 Y146.28922
G1 Z0 F4927.31133 X93.73658 Y149.78229
G1 Z0 F4914.93666 X97.43727 Y153.01671
G1 Z0 F4895.83482 X101.33784 Y155.97555
G1 Z0 F4870.00008 X105.41101 Y158.64505
G1 Z0 F4837.43467 X109.6283 Y161.01471
G1 Z0 F4798.14876 X113.96042 Y163.07745
G1 Z0 F4752.16046 X118.37776 Y164.82963
G1 Z0 F4699.49592 X122.85077 Y166.27097
G1 Z0 F4640.18925 X127.35037 Y167.40453
G1 Z0 F4574.28255 X131.84835 Y168.23655
G1 Z0 F4501.8259 X136.31771 Y168.77626
G1 Z0 F4422.87734 X140.73297 Y169.03562
G1 Z0 F4337.50284 X145.07047 Y169.02914
G1 Z0 F4245.77626 X149.30854 Y168.7735
G1 Z0 F4147.7793 X153.42773 Y168.28728
G1 Z0 F4043.60148 X157.41087 Y167.59065
G1 Z0 F3933.34007 X161.24321 Y166.70502
G1 Z0 F3817.10001 X164.91239 Y165.65273
G1 Z0 F3694.99387 X168.40847 Y164.45672
G1 Z0 F3567.14182 X171.7238 Y163.14026
G1 Z0 F3433.67149 X174.85298 Y161.72664
G1 Z0 F3294.71801 X177.7927 Y160.23894
G1 Z0 F3150.42392 X180.54155 Y158.6998
G1 Z0 F3000.93917 X183.09989 Y157.13119
G1 Z0 F2846.42119 X185.4696 Y155.55429
G1 Z0 F2687.03494 X187.65385 Y153.98929
G1 Z0 F2522.95314 X189.65692 Y152.45535
G1 Z0 F2354.35671 X191.48395 Y150.97044
G1 Z0 F2181.43534 X193.14068 Y149.55132
G1 Z0 F2004.38876 X194.63326 Y148.21348
G1 Z0 F1823.42874 X195.968 Y146.97117
G1 Z0 F1638.78276 X197.1512 Y145.83731
G1 Z0 F1450.70089 X198.18892 Y144.82356
G1 Z0 F1259.46937 X199.08678 Y143.94033
G1 Z0 F1065.43997 X199.84984 Y143.19675
G1 Z0 F869.10038 X200.48242 Y142.60078
G1 Z0 F671.2721 X200.98793 Y142.15912
G1 Z0 F473.81003 X201.36883 Y141.87733
G1 Z0 F283.20219 X201.62647 Y141.75975
G1 Z0 F143.47988 X201.76103 Y141.80955
G1 Z0 F219.41756 X201.77146 Y142.02872
G1 Z0 F406.20326 X201.65544 Y142.418
G1 Z0 F610.65045 X201.40938 Y142.97689
G1 Z0 F820.46227 X201.02841 Y143.70353
G1 Z0 F1032.82056 X200.50641 Y144.59473
G1 Z0 F1246.62657 X199.83609 Y145.64581
G1 Z0 F1461.27123 X199.00905 Y146.85051
G1 Z0 F1676.32648 X198.01589 Y148.20096
G1 Z0 F1891.44341 X196.84639 Y149.6875
G1 Z0 F2106.3121 X195.48961 Y151.29863
G1 Z0 F2320.64369 X193.93418 Y153.02084
G1 Z0 F2534.16163 X192.16847 Y154.83859
G1 Z0 F2746.5972 X190.18085 Y156.73416
G1 Z0 F2957.68701 X187.96006 Y158.68762
G1 Z0 F3167.17169 X185.49545 Y160.67676
G1 Z0 F3374.7952 X182.77739 Y162.6771
G1 Z0 F3580.30441 X179.79761 Y164.66191
G1 Z0 F3783.44903 X176.54961 Y166.60228
G1 Z0 F3983.98158 X173.02908 Y168.46722
G1 Z0 F4181.65748 X169.2343 Y170.22388
G1 Z0 F4376.23521 X165.16651 Y171.83774
G1 Z0 F4567.47647 X160.83039 Y173.27298
G1 Z0 F4755.14642 X156.23435 Y174.49276
G1 Z0 F4939.01388 X151.39092 Y175.45973
G1 Z0 F5118.85161 X146.31701 Y176.1365
G1 Z0 F5294.43648 X141.03413 Y176.48621
G1 Z0 F5465.54979 X135.5686 Y176.47315
G1 Z0 F5631.97748 X129.95154 Y176.06343
G1 Z0 F5793.5104 X124.21892 Y175.22567
G1 Z0 F5949.94452 X118.41138 Y173.93175
G1 Z0 F6101.08122 X112.57398 Y172.15749
G1 Z0 F6246.7275 X106.75588 Y169.88343
G1 Z0 F6386.6962 X101.00983 Y167.09546
G1 Z0 F6520.80629 X95.39157 Y163.78547
G1 Z0 F6648.88302 X89.95909 Y159.95196
G1 Z0 F6770.75819 X84.77187 Y155.60042
G1 Z0 F6886.27034 X79.88992 Y150.74374
G1 Z0 F6995.26497 X75.3728 Y145.40245
G1 Z0 F7097.59471 X71.27862 Y139.60474
G1 Z0 F7193.11953 X67.66289 Y133.38642
G1 Z0 F7281.70695 X64.57752 Y126.79068
G1 Z0 F7363.23216 X62.06974 Y119.86766
G1 Z0 F7437.57821 X60.18105 Y112.67388
G1 Z0 F7504.63619 X58.94639 Y105.27151
G1 Z0 F7564.30536 X58.39322 Y97.72745
G1 Z0 F7616.49328 X58.5409 Y90.11239
G1 Z0 F7661.11596 X59.40011 Y82.49961
G1 Z0 F7698.09801 X60.97254 Y74.96382
G1 Z0 F7727.37267 X63.25065 Y67.57988
G1 Z0 F7748.88202 X66.21772 Y60.42155
G1 Z0 F7762.577 X69.84807 Y53.5602
G1 Z0 F7768.41752 X74.10742 Y47.06357
G1 Z0 F7766.37253 X78.95352 Y40.99464
G1 Z0 F7756.42012 X84.33685 Y35.41058
G1 Z0 F7738.54752 X90.20158 Y30.36181
G1 Z0 F7712.75119 X96.48652 Y25.89124
G1 Z0 F7679.03683 X103.12631 Y22.03367
G1 Z0 F7637.41942 X110.05255 Y18.81538
G1 Z0 F7587.92325 X117.19505 Y16.25387
G1 Z0 F7530.58187 X124.48303 Y14.35783
G1 Z0 F7465.43814 X131.84635 Y13.12724
G1 Z0 F7392.5442 X139.21661 Y12.55375
G1 Z0 F7311.96143 X146.52826 Y12.62106
G1 Z0 F7223.76041 X153.71952 Y13.30558
G1 Z0 F7128.0209 X160.73321 Y14.5771
G1 Z0 F7024.83176 X167.5175 Y16.39966
G1 Z0 F6914.29088 X174.02641 Y18.73237
G1 Z0 F6796.5051 X180.22024 Y21.53038
G1 Z0 F6671.59015 X186.06586 Y24.74579
G1 Z0 F6539.6705 X191.53677 Y28.3286
G1 Z0 F6400.87928 X196.61311 Y32.22758
G1 Z0 F6255.35818 X201.2815 Y36.39119
G1 Z0 F6103.25728 X205.5348 Y40.7683
G1 Z0 F5944.73492 X209.37173 Y45.30899
G1 Z0 F5779.95759 X212.79646 Y49.96508
G1 Z0 F5609.09972 X215.81808 Y54.69073
G1 Z0 F5432.34356 X218.45006 Y59.44289
G1 Z0 F5249.87899 X220.70973 Y64.18158
G1 Z0 F5061.90335 X222.6176 Y68.87017
G1 Z0 F4868.62124 X224.19685 Y73.47554
G1 Z0 F4670.2444 X225.47274 Y77.96812
G1 Z0 F4466.99146 X226.472 Y82.32191
G1 Z0 F4259.08782 X227.22239 Y86.51437
G1 Z0 F4046.76547 X227.75217 Y90.52631
G1 Z0 F3830.26286 X228.08967 Y94.34168
G1 Z0 F3609.8248 X228.26289 Y97.94734
G1 Z0 F3385.70244 X228.29915 Y101.33285
G1 Z0 F3158.15332 X228.22482 Y104.49013
G1 Z0 F2927.44161 X228.06501 Y107.41321
G1 Z0 F2693.83858 X227.84339 Y110.09791
G1 Z0 F2457.62363 X227.58201 Y112.5416
G1 Z0 F2219.08601 X227.30117 Y114.74284
G1 Z0 F1978.52819 X227.01928 Y116.70119
G1 Z0 F1736.27234 X226.75282 Y118.41689
G1 Z0 F1492.6734 X226.51625 Y119.8907
G1 Z0 F1248.14808 X226.322 Y121.12364
G1 Z0 F1003.24676 X226.18042 Y122.11684
G1 Z0 F758.86465 X226.09978 Y122.87141
G1 Z0 F517.04485 X226.08628 Y123.38828
G1 Z0 F285.76188 X226.14403 Y123.66814
G1 Z0 F138.01971 X226.2751 Y123.7114
G1 Z0 F281.29403 X226.47947 Y123.51812
G1 Z0 F510.81783 X226.75512 Y123.08806
G1 Z0 F750.29636 X227.09799 Y122.42069
G1 Z0 F991.492 X227.50204 Y121.51526
G1 Z0 F1232.31923 X227.95925 Y120.37089
G1 Z0 F1471.86924 X228.45969 Y118.98672
G1 Z0 F1709.58422 X228.99156 Y117.36197
G1 Z0 F1945.04146 X229.54121 Y115.49621
G1 Z0 F2177.88021 X230.09326 Y113.38946
G1 Z0 F2407.77225 X230.63065 Y111.04242
G1 Z0 F2634.40859 X231.13478 Y108.4567
G1 Z0 F2857.49301 X231.58561 Y105.63499
G1 Z0 F3076.73864 X231.96186 Y102.58135
G1 Z0 F3291.86625 X232.24114 Y99.30135
G1 Z0 F3502.60323 X232.4002 Y95.80236
G1 Z0 F3708.68319 X232.41515 Y92.0937
G1 Z0 F3909.8457 X232.26175 Y88.18687
G1 Z0 F4105.8363 X231.91569 Y84.09564
G1 Z0 F4296.40658 X231.35294 Y79.83625
G1 Z0 F4481.31427 X230.55007 Y75.42744
G1 Z0 F4660.32346 X229.48462 Y70.89055
G1 Z0 F4833.2048 X228.13552 Y66.24945
G1 Z0 F4999.73568 X226.48343 Y61.53055
G1 Z0 F5159.70054 X224.51119 Y56.76267
G1 Z0 F5312.89099 X222.20413 Y51.97682
G1 Z0 F5459.10616 X219.5505 Y47.20607
G1 Z0 F5598.15283 X216.54179 Y42.48516
G1 Z0 F5729.84571 X213.17303 Y37.85023
G1 Z0 F5854.00767 X209.44306 Y33.33839
G1 Z0 F5970.46992 X205.35473 Y28.98729
G1 Z0 F6079.07224 X200.91507 Y24.83463
G1 Z0 F6179.66318 X196.13537 Y20.91766
G1 Z0 F6272.10023 X191.03115 Y17.27263
G1 Z0 F6356.25004 X185.62214 Y13.93428
G1 Z0 F6431.98858 X179.93212 Y10.93527
G1 Z0 F6499.2013 X173.98866 Y8.30565
M05 (pen up)
G4 P250 (wait 250ms)