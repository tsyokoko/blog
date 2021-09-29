# MySQL中是如何实现事务提交和回滚的？

#### 什么是事务

事务是由数据库中一系列的访问和更新组成的逻辑执行单元

事务的逻辑单元中可以是一条SQL语句，也可以是一段SQL逻辑，这段逻辑要么全部执行成功，要么全部执行失败

举个最常见的例子，你早上出去买早餐，支付宝扫码付款给早餐老板，这就是一个简单的转账过程，会包含两步

- 从你的支付宝账户扣款10元
- 早餐老板的账户增加10元

这两步其中任何一部出现问题，都会导致整个账务出现问题

- 假如你的支付宝账户扣款10元失败，早餐老板的账户增加成功，那你就Happy了，相当于马云请你吃早餐了，O(∩_∩)O哈哈~
- 假如你的支付宝账户扣款10元成功，早餐老板的账户增加失败，那你就悲剧了，早餐老板不会放过你，会让你重新付款，相当于你请马云吃早餐了-_-?

事务就是用来保证一系列操作的原子性，上述两步操作，要么全部执行成功，要么全部执行失败

数据库为了保证事务的原子性和持久性，引入了redo log和undo log

#### redo log

redo log是重做日志，通常是物理日志，记录的是物理数据页的修改，它用来恢复提交后的物理数据页

![pic_16ca1820.png](/Users/mbpzy/images/pic_16ca1820.png)

如上图所示，redo log分为两部分：

- 内存中的redo log Buffer是日志缓冲区，这部分数据是容易丢失的
- 磁盘上的redo log file是日志文件，这部分数据已经持久化到磁盘，不容易丢失

SQL操作数据库之前，会先记录重做日志，为了保证效率会先写到日志缓冲区中（redo log Buffer），再通过缓冲区写到磁盘文件中进行持久化，既然有缓冲区说明数据不是实时写到redo log file中的，那么假如redo log写到缓冲区后，此时服务器断电了，那redo log岂不是会丢失？

在MySQL中可以自已控制log buffer刷新到log file中的频率，通过innodb_flush_log_at_trx_commit参数可以设置事务提交时log buffer如何保存到log file中，innodb_flush_log_at_trx_commit参数有3个值(0、1、2)，表示三种不同的方式

- 为1表示事务每次提交都会将log buffer写入到os buffer，并调用操作系统的fsync()方法将日志写入log file，这种方式的好处是就算MySQL崩溃也不会丢数据，redo log file保存了所有已提交事务的日志，MySQL重新启动后会通过redo log file进行恢复。但这种方式每次提交事务都会写入磁盘，IO性能较差
- 为0表示事务提交时不会将log buffer写入到os buffer中，而是每秒写入os buffer然后调用fsync()方法将日志写入log file，这种方式在MySQL系统崩溃时会丢失大约1秒钟的数据
- 为2表示事务每次提交仅将log buffer写入到os buffer中，然后每秒调用fsync()方法将日志写入log file，这种方式在MySQL崩溃时也会丢失大约1秒钟的数据

#### undo log

undo log是回滚日志，用来回滚行记录到某个版本，undo log一般是逻辑日志，根据行的数据变化进行记录

undo log跟redo log一样也是在SQL操作数据之前记录的，也就是SQL操作先记录日志，再进行操作数据

![pic_32144566.png](/Users/mbpzy/images/pic_32144566.png)

如上图所示，SQL操作之前会先记录redo log、undo log到日志缓冲区，日志缓冲区的数据会记录到os buffer中，再通过调用fsync()方法将日志记录到log file中

undo log记录的是逻辑日志，可以简单的理解为：**当insert一条记录时，undo log会记录一条对应的delete语句；当update一条语句时，undo log记录的是一条与之操作相反的语句**

当事务需要回滚时，可以从undo log中找到相应的内容进行回滚操作，回滚后数据恢复到操作之前的状态

undo日志还有一个用途就是用来控制数据的多版本（MVCC），在[《InnoDB存储引擎中的锁》](https://blog.csdn.net/pzjtian/article/details/107372792)一文中讲到MVCC是通过读取undo日志中数据的快照来进行多版本控制的

undo log是采用段(segment)的方式来记录的，每个undo操作在记录的时候占用一个undo log segment。

另外，undo log也会产生redo log，因为undo log也要实现持久性保护

### 总结一下

MySQL中是如何实现事务提交和回滚的？

- 为了保证数据的持久性，数据库在执行SQL操作数据之前会先记录redo log和undo log
- redo log是重做日志，通常是物理日志，记录的是物理数据页的修改，它用来恢复提交后的物理数据页
- undo log是回滚日志，用来回滚行记录到某个版本，undo log一般是逻辑日志，根据行的数据变化进行记录
- redo/undo log都是写先写到日志缓冲区，再通过缓冲区写到磁盘日志文件中进行持久化保存
- undo日志还有一个用途就是用来控制数据的多版本（MVCC）

简单理解就是：

**redo log是用来恢复数据的，用于保障已提交事务的持久性**

**undo log是用来回滚事务的，用于保障未提交事务的原子性**