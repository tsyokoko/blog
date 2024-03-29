## B+树与LSM树

**B+树是基于B-树的一种变体，但却有着比B-树更高的查询性能。**首先我们回顾下B-树的几大特征。

**一个m阶的B树具有如下几个特征：**

1.根结点至少有两个子女。

2.每个中间节点都包含k-1个元素和k个孩子，其中 m/2 <= k <= m

3.每一个叶子节点都包含k-1个元素，其中 m/2 <= k <= m

4.所有的叶子结点都位于同一层。

5.每个节点中的元素从小到大排列，节点当中k-1个元素正好是k个孩子包含的元素的值域划分。



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-b967ddbd1e9f24d4a8587ac3bfbad961_1440w.jpg)





B+树和B-树有一些共同点，但是B+树也具备一些新的特征

**一个m阶的B+树具有如下几个特征：**

1.有k个子树的中间节点包含有k个元素（B树中是k-1个元素），每个元素不保存数据，只用来索引，所有数据都保存在叶子节点。

2.所有的叶子结点中包含了全部元素的信息，及指向含这些元素记录的指针，且叶子结点本身依关键字的大小自小而大顺序链接。

3.所有的中间节点元素都同时存在于子节点，在子节点元素中是最大（或最小）元素。



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-6eff523bb45a73ad7e6c346d526c8a42_1440w.jpg)



由图我们可以看出，不但叶子节点之间含有重复元素，而且叶子节点还用指针连接在一起。每一个父节点的元素都出现在了子节点中，是子节点的最大（或最小）元素



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-95b2102f85db2137abdf4dd163ccbc69_1440w.jpg)



在上图的树中，根节点元素8是子节点2,5,8的最大元素，也是叶子节点6,8的最大元素。

同样，根元素15是子节点11,15的最大元素，也是叶子节点13,15的最大元素。

注意：根节点的最大元素（这里是15）,也就等同于整个B+树的最大元素，以后无论插入删除多少元素，始终要保持最大元素在根节点当中。

至于叶子节点，由于父节点的元素都出现在了子节点中，因此所有的叶子节点包含了全量的元素信息。并且每一个叶子节点都带有指向下一个节点的指针，形成了一个有序链表



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-2c52fec0257eec24c9c7a04a559ba8fc_1440w.jpg)



B+树还具有一个特点，这个特点在索引之外，**却是至关重要的特点，那就是[卫星数据]的位置。**

**卫星数据：**

指的是索引元素所指向的数据记录，比如数据库中的某一行。在B-树中，无论中间节点还是叶子节点都带有卫星数据。



B-树中的卫星数据（Satellite Information）：



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-60e94826f7c0038447d36de2ed286698_1440w.jpg)



而在B+树中，只有叶子节点带有卫星数据，其余中间节点仅仅是索引，没有任何数据关联



B+树中的卫星数据（Satellite Information）：



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-d60c33b5b77d4d2dfb12e317e154b93e_1440w.jpg)



需要补充的是，**在数据库的聚集索引（Clustered Index）中，叶子节点直接包含卫星数据**。在**非聚集索引（NonClustered Index）中，叶子节点带有指向卫星数据的指针**。



那么B+树设计成这个样子，究竟有什么好处呢？

B+树的好处主要体现在查询性能上。下面我们分别通过单行查询和范围查询来做分析：

在单元素查询的时候，B+树会自顶向下逐层查找节点，最终找到匹配的叶子节点，比如我们要查找的是元素3：

第一次磁盘IO：



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-f8762e67fa8cfbb436237caa338345ae_1440w.jpg)



第二次磁盘IO：





![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-967b07063088446df06db8fbfa547a9b_1440w.jpg)



第三次磁盘IO：



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-7bf3b4905fa76a2b6b65f69f2b947be1_1440w.jpg)



流程看起来与B-树相差不大，但是有两点不同，首先B+树中间节点没有卫星数据，**所以同样大小的磁盘页可以容纳更多的节点元素，这就意味着，在相同数据量的情况下，B+树的结构比B-树更加“矮胖”因此查询是IO次数也更少**。

其次，B+树的查询必须最终查找到叶子节点，而B-树只要找到匹配元素即可，无论匹配元素处于中间节点还是叶子节点。因此B-树的查找性能并不稳定（最好情况是指查找根节点，最坏情况是查找到叶子节点）。而B+树的每一次查找都是稳定的。

下面来分析下范围查询，B-树只能依靠繁琐的中序遍历自顶向下查找到范围的下限，假如我们查找的范围是3~11。

自顶向下查找到范围的下限：3



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-f8792d03a34df1346c7e8c3327f8701c_1440w.jpg)



中序遍历到元素6：



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-1d775415cc10fffbc5232f28a8ff5ab0_1440w.jpg)



中序遍历到元素8：



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-ed2d0936b377b754cab5e680d8c64d61_1440w.jpg)



中序遍历到元素11，遍历结束：



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-857b5d1574dbc0aea61feed0b69e5f79_1440w.jpg)





反观B+树则要简单很多，只需要在链表上做遍历即可：

B+树的范围查找过程：

自顶向下查找范围的下限3：



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-de20ae7c5d832eee69879682c6b1596f_1440w.jpg)



然后通过链表指针，遍历元素即可



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-2bfce5003df9f8f7a41f8deb9419d663_1440w.jpg)







![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-bdcea290866517d7a9846e6960dc56c7_1440w.jpg)







**综合起来B+树的特征和优势如下所示：**



**B+树的特征：**

1.有k个子树的中间节点包含有k个元素（B树中是k-1个元素），每个元素不保存数据，只用来索引，所有数据都保存在叶子节点。

2.所有的叶子结点中包含了全部元素的信息，及指向含这些元素记录的指针，且叶子结点本身依关键字的大小自小而大顺序链接。

3.所有的中间节点元素都同时存在于子节点，在子节点元素中是最大（或最小）元素。



**B+树的优势：**

1.单一节点存储更多的元素，使得查询的IO次数更少。

· B+树的内部并没有指向关键字具体信息的指针，因此其内部节点相对于B树更加小，如果把所有同一内部节点的关键字存放在同一块盘中，那么盘块所能容纳的关键字数量也越多，一次性读入内存中的可供查找的关键字也就越多，相对来说IO读写次数也就下降了。

2.所有查询都要查找到叶子节点，查询性能稳定。

由于非叶子节点并不是最终指向文件内容的节点，而只是叶子节点中关键字的索引，所以任何关键字的查找必须走一条从根节点到叶子节点的路。所有关键字查询的路径长度相同，导致每一次数据的查询效率相当。

3.所有叶子节点形成有序链表，便于范围查询。

B+树只要遍历叶子节点就可以实现整棵树的遍历，而且在数据库中基于范围的查询是非常频繁的，而B树的效率却非常低。



**LSM树：**

**核心思想是放弃部分读性能，提高写性能。**

LSM Tree（Log-Structured Merge Tree）日志结构合并树，核心思路就是假设内存足够大，不需要每次有数据更新就必须把数据写入到磁盘中，可以先把最新的数据驻留在磁盘中，等到积累到最后多之后，再使用归并排序的方式将内存内的数据合并追加到磁盘队尾(因为所有待排序的树都是有序的，可以通过合并排序的方式快速合并到一起)。

日志结构的合并树（LSM-tree）是一种基于硬盘的数据结构，与B-tree相比，能显著地减少硬盘磁盘臂的开销，并能在较长的时间提供对文件的高速插入（删除）。然而LSM-tree在某些情况下，特别是在查询需要快速响应时性能不佳。通常LSM-tree适用于索引插入比检索更频繁的应用[系统](https://link.zhihu.com/?target=https%3A//www.2cto.com/os/)。Bigtable在提供Tablet服务时，使用GFS来存储日志和SSTable，而GFS的设计初衷就是希望通过添加新数据的方式而不是通过重写旧数据的方式来修改文件。而LSM-tree通过滚动合并和多页块的方法推迟和批量进行索引更新，充分利用内存来存储近期或常用数据以降低查找代价，利用硬盘来存储不常用数据以减少存储代价。

磁盘的技术特性：对磁盘来说，能够最大化的发挥磁盘技术特性的使用方式是:一次性的读取或写入固定大小的一块数据，并尽可能的减少随机寻道这个操作的次数。



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-0c514efb40fbbc4575c8b9568de1c3fb_1440w.jpg)



LSM和Btree差异就要在读性能和写性能进行舍和求。在牺牲的同时，寻找其他方案来弥补。

**1.LSM具有批量特性,存储延迟**

当写读比例很大的时候（写比读多），LSM树相比于B树有更好的性能。因为随着insert操作，为了维护B树结构，节点分裂。读磁盘的随机读写概率会变大，性能会逐渐减弱。 多次单页随机写，变成一次多页随机写,复用了磁盘寻道时间，极大提升效率。

**2.B树的写入过程**

对B树的写入过程是一次原位写入的过程，主要分为两个部分，首先是查找到对应的块的位置，然后将新数据写入到刚才查找到的数据块中，然后再查找到块所对应的磁盘物理位置，将数据写入去。当然，在内存比较充足的时候，因为B树的一部分可以被缓存在内存中，所以查找块的过程有一定概率可以在内存内完成，不过为了表述清晰，我们就假定内存很小，只够存一个B树块大小的数据吧。可以看到，在上面的模式中，需要两次随机寻道（一次查找，一次原位写），才能够完成一次数据的写入，代价还是很高的。

**3.LSM树放弃磁盘读性能来换取写的顺序性**

似乎会认为读应该是大部分系统最应该保证的特性，所以用读换写似乎不是个好的做法，但是：

a. 内存的速度远超磁盘，1000倍以上。而读取的性能提升，主要还是依靠内存命中率而非磁盘读的次数

b. 写入不占用磁盘的io，读取就能获取更长时间的磁盘io使用权，从而也可以提升读取效率。例如LevelDb的SSTable虽然降低了了读的性能，但如果数据的读取命中率有保障的前提下，因为读取能够获得更多的磁盘io机会，因此读取性能基本没有降低，甚至还会有提升。而写入的性能则会获得较大幅度的提升，基本上是5~10倍左右.

通过以上的分析，应该知道LSM树的由来了，LSM树的设计思想非常朴素：**将对数据的修改增量保持在内存中，达到指定的大小限制后将这些修改操作批量写入磁盘，不过读取的时候稍微麻烦，需要合并磁盘中历史数据和内存中最近修改操作，所以写入性能大大提升，读取时可能需要先看是否命中内存，否则需要访问较多的磁盘文件。极端的说，基于LSM树实现的HBase的写性能比MySQL高了一个数量级，读性能低了一个数量级**。

LSM树原理把一棵大树拆分成N棵小树，它首先写入内存中，随着小树越来越大，内存中的小树会flush到磁盘中，磁盘中的树定期可以做merge操作，合并成一棵大树，以优化读性能。



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-6467430d6c927b3f0073b3efc625b768_1440w.jpg)



以上这些大概就是HBase存储的设计主要思想，这里分别对应说明下：

因为小树先写到内存中，为了防止内存数据丢失，写内存的同时需要暂时持久化到磁盘，对应了HBase的MemStore和HLog

MemStore上的树达到一定大小之后，需要flush到HRegion磁盘中（一般是Hadoop DataNode），这样MemStore就变成了DataNode上的磁盘文件StoreFile，定期HRegionServer对DataNode的数据做merge操作，彻底删除无效空间，多棵小树在这个时机合并成大树，来增强读性能。

关于LSM Tree，对于最简单的二层LSM Tree而言，内存中的数据和磁盘你中的数据merge操作，如下图



![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/v2-b58bce80eb1a280fe0bfb7e5c900302e_1440w.jpg)



lsm tree，理论上，可以是内存中树的一部分和磁盘中第一层树做merge，对于磁盘中的树直接做update操作有可能会破坏物理block的连续性，但是实际应用中，一般lsm有多层，当磁盘中的小树合并成一个大树的时候，可以重新排好顺序，使得block连续，优化读性能。

hbase在实现中，是把整个内存在一定阈值后，flush到disk中，形成一个file，这个file的存储也就是一个小的B+树，因为hbase一般是部署在hdfs上，hdfs不支持对文件的update操作，所以hbase这么整体内存flush，而不是和磁盘中的小树merge update，这个设计也就能讲通了。内存flush到磁盘上的小树，定期也会合并成一个大树。整体上hbase就是用了lsm tree的思路。