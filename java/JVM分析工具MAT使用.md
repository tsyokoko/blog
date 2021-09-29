## JVM分析工具MAT

MAT是一个强大的内存分析工具，可以快捷、有效地帮助我们找到内存泄露，减少内存消耗分析工具。内存中堆的使用情况是应用性能监测的重点，而对于堆的快照，可以dump出来进一步分析，总的来说，一般我们对于堆dump快照有三种方式：

- 添加启动参数发生OOM时自动dump： java应用的启动参数一般最好都加上`-XX:+HeapDumpOnOutOfMemoryError`及`-XX:HeapDumpPath=logs/heapdump.hprof`，即在发生OOM时自动dump堆快照，但这种方式相当来说是滞后的（需要等到发生OOM后）。
- 使用命令按需手动dump： 我们也可以使用`jmap -dump:format=b,file=HeapDump.hprof <pid>`工具手动进行堆dump和线程dump
- 使用工具手动dump：jvisualvm有提供dump堆快照的功能，点击一下即可。

使用MAT，可以轻松实现以下功能：

- 找到最大的对象，因为MAT提供显示合理的累积大小（`retained size`）
- 探索对象图，包括`inbound`和`outbound`引用，即引用此对象的和此对象引出的。
- 查找无法回收的对象，可以计算从垃圾收集器根到相关对象的路径
- 找到内存浪费，比如冗余的String对象，空集合对象等等。

之前使用arthas，可以诊断stack、thread、class、function的性能及调用分析，arthas依赖jdk，如果jre需要手工安装jps、tools.jar等，但arthas没有整合jmap功能，没有heap分析。

所以目前看来在线jvm诊断 arthas、jmap加上eclipse mat就可以覆盖性能分析、heap分析的全部要求了。