# Java并发编程的艺术笔记

## 第1章　并发编程的挑战

### 1.1上下文切换

线程有创建和上下文切换的开销，减少上下文切换的方法有:

**无锁并发编程**。多线程竞争锁时，会引起上下文切换，所以多线程处理数据时，可以用一些办法来避免使用锁，如将数据的ID按照Hash算法取模分段，不同的线程处理不同段的数据。

**CAS算法**。Java的Atomic包使用CAS算法来更新数据，而不需要加锁。·

**使用最少线程**。避免创建不需要的线程，比如任务很少，但是创建了很多线程来处理，这样会造成大量线程都处于等待状态。

**协程**。在单线程里实现多任务的调度，并在单线程里维持多个任务间的切换。

### 1.2　死锁

避免死锁的几个常见方法。

避免一个线程同时获取多个锁。

避免一个线程在锁内同时占用多个资源，尽量保证每个锁只占用一个资源。

尝试使用定时锁，使用lock.tryLock（timeout）来替代使用内部锁机制。对于数据库锁，加锁和解锁必须在一个数据库连接里，否则会出现解锁失败的情况。

### 1.3　资源限制的挑战

资源限制是指在进行并发编程时，程序的执行速度受限于计算机硬件资源或软件资源。

在并发编程中，将代码执行速度加快的原则是将代码中串行执行的部分变成并发执行，但是如果将某段串行的代码并发执行，因为受限于资源，仍然在串行执行，这时候程序不仅不会加快执行，反而会更慢，因为增加了上下文切换和资源调度的时间。根据不同的资源限制调整程序的并发度。

## 第2章　Java并发机制的底层实现原理

### 2.1　volatile的应用

volatile的定义如下：Java编程语言允许线程访问共享变量，为了确保共享变量能被准确和一致地更新，线程应该确保通过排他锁单独获得这个变量。

**1）Lock前缀指令会引起处理器缓存回写到内存。**

**2）一个处理器的缓存回写到内存会导致其他处理器的缓存无效。**

追加64字节能够提高并发编程的效率，高速缓存行是64个字节宽，处理器不支持部分填充缓存行，这意味着，如果队列的头节点和尾节点都不足64字节的话，处理器会将它们都读到同一个高速缓存行中，在多处理器下每个处理器都会缓存同样的头、尾节点，当一个处理器试图修改头节点时，会将整个缓存行锁定，那么在缓存一致性机制的作用下，会导致其他处理器不能访问自己高速缓存中的尾节点，而队列的入队和出队操作则需要不停修改头节点和尾节点，所以在多处理器的情况下将会严重影响到队列的入队和出队效率。

那么是不是在使用volatile变量时都应该追加到64字节呢？不是的。在两种场景下不应该使用这种方式。

·缓存行非64字节宽的处理器。如P6系列和奔腾处理器，它们的L1和L2高速缓存行是32个字节宽。

·共享变量不会被频繁地写。

### 2.2　synchronized的实现原理与应用

synchronized实现同步的基础：Java中的每一个对象都可以作为锁。具体表现为以下3种形式。

·对于普通同步方法，锁是当前实例对象。

·对于静态同步方法，锁是当前类的Class对象。

·对于同步方法块，锁是Synchonized括号里配置的对象。

**JVM基于进入和退出Monitor对象来实现方法同步和代码块同步**。

monitorenter指令是在编译后插入到同步代码块的开始位置，而monitorexit是插入到方法结束处和异常处，JVM要保证每个monitorenter必须有对应的monitorexit与之配对。

任何对象都有一个monitor与之关联，当且一个monitor被持有后，它将处于锁定状态。线程执行到monitorenter指令时，将会尝试获取对象所对应的monitor的所有权，即尝试获得对象的锁。

#### 2.2.1　Java对象头

**synchronized用的锁是存在Java对象头里的，Java对象头里的MarkWord里默认存储对象的HashCode、分代年龄和锁标记位。**

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909114238260.png" alt="image-20210909114238260" style="zoom:50%;" />

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909214724413.png" alt="image-20210909214724413" style="zoom:50%;" />

#### 2.2.2　锁的升级与对比

锁一共有4种状态，级别从低到高依次是：**无锁状态、偏向锁状态、轻量级锁状态和重量级锁状态**，这几个状态会随着竞争情况逐渐升级。锁可以升级但不能降级，意味着偏向锁升级成轻量级锁后不能降级成偏向锁。这种锁升级却不能降级的策略，目的是为了提高获得锁和释放锁的效率。

##### 0.无锁

无锁是指没有对资源进行锁定，所有的线程都能访问并修改同一个资源，但同时只有一个线程能修改成功。无锁的特点是修改操作会在循环内进行，线程会不断的尝试修改共享资源。如果没有冲突就修改成功并退出，否则就会继续循环尝试。如果有多个线程修改同一个值，必定会有一个线程能修改成功，而其他修改失败的线程会不断重试直到修改成功。

##### 1.偏向锁

初次执行到synchronized代码块的时候，锁对象变成偏向锁（通过CAS修改对象头里的锁标志位），字面意思是“偏向于第一个获得它的线程”的锁。执行完同步代码块后，线程并不会主动释放偏向锁。当第二次到达同步代码块时，线程会判断此时持有锁的线程是否就是自己（持有锁的线程ID也在对象头里），如果是则正常往下执行。由于之前没有释放锁，这里也就不需要重新加锁。如果自始至终使用锁的线程只有一个，很明显偏向锁几乎没有额外开销，性能极高。

当一个线程访问同步代码块并获取锁时，会在 Mark Word 里存储锁偏向的线程 ID。在线程进入和退出同步块时不再通过 CAS 操作来加锁和解锁，而是检测 Mark Word 里是否存储着指向当前线程的偏向锁。轻量级锁的获取及释放依赖多次 CAS 原子指令，而偏向锁只需要在置换 ThreadID 的时候依赖一次 CAS 原子指令即可。

偏向锁只有遇到其他线程尝试竞争偏向锁时，持有偏向锁的线程才会释放锁，线程是不会主动释放偏向锁的。

大多数情况下，锁不仅不存在多线程竞争，而且总是由同一线程多次获得，为了让线程获得锁的代价更低而引入了偏向锁。当一个线程访问同步块并 获取锁时，会在对象头和栈帧中的锁记录里存储锁偏向的线程ID，以后该线程在进入和退出 同步块时不需要进行CAS操作来加锁和解锁，只需简单地测试一下对象头的Mark Word里是否 存储着指向当前线程的偏向锁。如果测试成功，表示线程已经获得了锁。如果测试失败，则需要再测试一下Mark Word中偏向锁的标识是否设置成1（表示当前是偏向锁）：如果没有设置，则 使用CAS竞争锁；如果设置了，则尝试使用CAS将对象头的偏向锁指向当前线程。

（1）偏向锁的撤销

偏向锁使用了一种等到竞争出现才释放锁的机制，所以当其他线程尝试竞争偏向锁时，持有偏向锁的线程才会释放锁。偏向锁的撤销，需要等待全局安全点（在这个时间点上没有正在执行的字节码）。它会首先暂停拥有偏向锁的线程，然后检查持有偏向锁的线程是否活着，如果线程不处于活动状态，则将对象头设置成无锁状态；如果线程仍然活着，拥有偏向锁的栈会被执行，遍历偏向对象的锁记录，栈中的锁记录和对象头的MarkWord要么重新偏向于其他线程，要么恢复到无锁或者标记对象不适合作为偏向锁，最后唤醒暂停的线程。

（2）关闭偏向锁

偏向锁在Java6和Java7里是默认启用的，但是它在应用程序启动几秒钟之后才激活，如有必要可以使用JVM参数来关闭延迟：-XX:BiasedLockingStartupDelay=0。

如果你确定应用程序里所有的锁通常情况下处于竞争状态，可以通过JVM参数关闭偏向锁：-XX:UseBiasedLocking=false，那么程序默认会进入轻量级锁状态。

##### 2.轻量级锁

轻量级锁是指当锁是偏向锁的时候，却被另外的线程所访问，此时偏向锁就会升级为轻量级锁，其他线程会通过自旋（关于自旋的介绍见文末）的形式尝试获取锁，线程不会阻塞，从而提高性能。

轻量级锁的获取主要由两种情况：
			① 当关闭偏向锁功能时；
			② 由于多个线程竞争偏向锁导致偏向锁升级为轻量级锁。

一旦有第二个线程加入锁竞争，偏向锁就升级为轻量级锁（自旋锁）。这里要明确一下什么是锁竞争：如果多个线程轮流获取一个锁，但是每次获取锁的时候都很顺利，没有发生阻塞，那么就不存在锁竞争。只有当某线程尝试获取锁的时候，发现该锁已经被占用，只能等待其释放，这才发生了锁竞争。

在轻量级锁状态下继续锁竞争，没有抢到锁的线程将自旋，即不停地循环判断锁是否能够被成功获取。获取锁的操作，其实就是通过CAS修改对象头里的锁标志位。先比较当前锁标志位是否为“释放”，如果是则将其设置为“锁定”，比较并设置是原子性发生的。这就算抢到锁了，然后线程将当前锁的持有者信息修改为自己。

长时间的自旋操作是非常消耗资源的，一个线程持有锁，其他线程就只能在原地空耗CPU，执行不了任何有效的任务，这种现象叫做忙等。如果多个线程用一个锁，但是没有发生锁竞争，或者发生了很轻微的锁竞争，那么synchronized就用轻量级锁，允许短时间的忙等现象。这是一种折衷的想法，短时间的忙等，换取线程在用户态和内核态之间切换的开销。

线程在执行同步块之前，JVM会先在当前线程的栈桢中创建用于存储锁记录的空间，并将对象头中的MarkWord复制到锁记录中，官方称为DisplacedMarkWord。然后线程尝试使用CAS将对象头中的MarkWord替换为指向锁记录的指针。如果成功，当前线程获得锁，如果失败，表示其他线程竞争锁，当前线程便尝试使用自旋来获取锁。

（2）轻量级锁解锁

轻量级解锁时，会使用原子的CAS操作将DisplacedMarkWord替换回到对象头，如果成功，则表示没有竞争发生。如果失败，表示当前锁存在竞争，锁就会膨胀成重量级锁。

因为自旋会消耗CPU，为了避免无用的自旋（比如获得锁的线程被阻塞住了），一旦锁升级 成重量级锁，就不会再恢复到轻量级锁状态。当锁处于这个状态下，其他线程试图获取锁时， 都会被阻塞住，当持有锁的线程释放锁之后会唤醒这些线程，被唤醒的线程就会进行新一轮 的夺锁之争。

##### 3.重量级锁

此忙等是有限度的（有个计数器记录自旋次数，默认允许循环10次，可以通过虚拟机参数更改）。如果锁竞争情况严重，某个达到最大自旋次数的线程，会将轻量级锁升级为重量级锁（依然是CAS修改锁标志位，但不修改持有锁的线程ID）。当后续线程尝试获取锁时，发现被占用的锁是重量级锁，则直接将自己挂起（而不是忙等），等待将来被唤醒。

重量级锁是指当有一个线程获取锁之后，其余所有等待获取该锁的线程都会处于阻塞状态。

![image-20210909114610360](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909114610360.png)

### 2.3　原子操作的实现原理

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909114804365.png" alt="image-20210909114804365" style="zoom:50%;" />

32位IA-32处理器使用基于对缓存加锁或总线加锁的方式来实现多处理器之间的原子操作。首先处理器会自动保证基本的内存操作的原子性。处理器保证从系统内存中读取或者写入一个字节是原子的，意思是当一个处理器读取一个字节时，其他处理器不能访问这个字节 的内存地址。

Pentium 6和最新的处理器能自动保证单处理器对同一个缓存行里进行16/32/64位的操作是原子的，但是复杂的内存操作处理器是不能自动保证其原子性的，比如跨总线宽度、 跨多个缓存行和跨页表的访问。但是，处理器提供**总线锁定**和**缓存锁定**两个机制来保证复杂、内存操作的原子性。

有两种情况下处理器不会使用缓存锁定。

第一种情况是：当操作的数据不能被缓存在处理器内部，或操作的数据跨多个缓存行 （cache line）时，则处理器会调用总线锁定。

第二种情况是：有些处理器不支持缓存锁定。对于Intel 486和Pentium处理器，就算锁定的内存区域在处理器的缓存行中也会调用总线锁定。

#### Java如何实现原子操作

##### （1）使用循环CAS实现原子操作

自旋CAS实现的基本思路就是循环进行CAS操作直到成功为止。

##### （2）CAS实现原子操作的三大问题

**1）ABA问题**

因为CAS需要在操作值的时候，检查值有没有发生变化，如果没有发生变化 则更新，但是如果一个值原来是A，变成了B，又变成了A，那么使用CAS进行检查时会发现它 的值没有发生变化，但是实际上却变化了。ABA问题的解决思路就是使用版本号。在变量前面 追加上版本号，每次变量更新的时候把版本号加1，那么A→B→A就会变成1A→2B→3A。从 Java 1.5开始，JDK的Atomic包里提供了一个类AtomicStampedReference来解决ABA问题。这个 类的compareAndSet方法的作用是首先检查当前引用是否等于预期引用，并且检查当前标志是 否等于预期标志，如果全部相等，则以原子方式将该引用和该标志的值设置为给定的更新值。

**2）循环时间长开销大**

自旋CAS如果长时间不成功，会给CPU带来非常大的执行开销。如 果JVM能支持处理器提供的pause指令，那么效率会有一定的提升。pause指令有两个作用：第 一，它可以延迟流水线执行指令（de-pipeline），使CPU不会消耗过多的执行资源，延迟的时间 取决于具体实现的版本，在一些处理器上延迟时间是零；第二，它可以避免在退出循环的时候 因内存顺序冲突（Memory Order Violation）而引起CPU流水线被清空（CPU Pipeline Flush），从而 提高CPU的执行效率。

**3）只能保证一个共享变量的原子操作**

当对一个共享变量执行操作时，我们可以使用循 环CAS的方式来保证原子操作，但是对多个共享变量操作时，循环CAS就无法保证操作的原子 性，这个时候就可以用锁。还有一个取巧的办法，就是把多个共享变量合并成一个共享变量来 操作。比如，有两个共享变量i＝2，j=a，合并一下ij=2a，然后用CAS来操作ij。从Java 1.5开始， JDK提供了AtomicReference类来保证引用对象之间的原子性，就可以把多个变量放在一个对 象里来进行CAS操作。

##### （3）使用锁机制实现原子操作

锁机制保证了只有获得锁的线程才能够操作锁定的内存区域。JVM内部实现了很多种锁 机制，有偏向锁、轻量级锁和互斥锁。有意思的是除了偏向锁，JVM实现锁的方式都用了循环 CAS，即当一个线程想进入同步块的时候使用循环CAS的方式来获取锁，当它退出同步块的时 候使用循环CAS释放锁。

## 第3章　Java内存模型

### 3.1　Java内存模型的基础

#### 3.1.1　并发编程模型的两个关键问题

在并发编程中，需要处理两个关键问题：线程之间如何通信及线程之间如何同步？

在命令式编程中，线程之间的通信机制有两种：共享内存和消息传递。在共享内存的并发模型里，线程之间共享程序的公共状态，通过写-读内存中的公共状态进行隐式通信。在消息传递的并发模型里，线程之间没有公共状态，线程之间必须通过发送 息来显式进行通信。

同步是指程序中用于控制不同线程间操作发生相对顺序的机制。在共享内存并发模型里，同步是显式进行的。程序员必须显式指定某个方法或某段代码需要在线程之间互斥执行。在消息传递的并发模型里，由于消息的发送必须在消息的接收之前，因此同步是隐式进行的。

Java的并发采用的是共享内存模型，Java线程之间的通信总是隐式进行，整个通信过程对程序员完全透明。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909122926273.png"/>

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909122950605.png"/>

从整体来看，这两个步骤实质上是线程A在向线程B发送消息，而且这个通信过程必须要 经过主内存。JMM通过控制主内存与每个线程的本地内存之间的交互，来为Java程序员提供 内存可见性保证。

#### 3.1.3　从源代码到指令序列的重排序

从Java源代码到最终实际执行的指令序列，会分别经历下面3种重排序，如图3-3所示。

![image-20210909123557461](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909123557461.png)

上述的1属于编译器重排序，2和3属于处理器重排序。这些重排序可能会导致多线程程序 出现内存可见性问题。对于编译器，JMM的编译器重排序规则会禁止特定类型的编译器重排序（不是所有的编译器重排序都要禁止）。对于处理器重排序，JMM的处理器重排序规则会要 求Java编译器在生成指令序列时，插入特定类型的内存屏障指令，通过内存屏障指令来禁止特定类型的处理器重排序。

JMM属于语言级的内存模型，它确保在不同的编译器和不同的处理器平台之上，通过禁 止特定类型的编译器重排序和处理器重排序，为程序员提供一致的内存可见性保证。

为了保证内存可见性，Java编译器在生成指令序列的适当位置会插入内存屏障指令来禁 止特定类型的处理器重排序。JMM把内存屏障指令分为4类。

![image-20210909123832419](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909123832419.png)

StoreLoad Barriers是一个“全能型”的屏障，它同时具有其他3个屏障的效果。

##### 3.1.5　happens-before简介

从JDK 5开始，Java使用新的JSR-133内存模型。JSR-133使用happens-before的概念来阐述操作之间的内存可见性。在JMM中，如果一 个操作执行的结果需要对另一个操作可见，那么这两个操作之间必须要存在happens-before关 系。这里提到的两个操作既可以是在一个线程之内，也可以是在不同线程之间。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909124040832.png"/>

如图3-5所示，一个happens-before规则对应于一个或多个编译器和处理器重排序规则。对 于Java程序员来说，happens-before规则简单易懂，它避免Java程序员为了理解JMM提供的内存 可见性保证而去学习复杂的重排序规则以及这些规则的具体实现方法。

### 3.2　重排序

重排序是指编译器和处理器为了优化程序性能而对指令序列进行重新排序的一种手段。

#### 3.2.1　数据依赖性

如果两个操作访问同一个变量，且这两个操作中有一个为写操作，此时这两个操作之间 就存在数据依赖性。数据依赖分为下列3种类型，如表3-4所示。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909124150250.png" alt="image-20210909124150250" style="zoom:50%;" />

上面3种情况，只要重排序两个操作的执行顺序，程序的执行结果就会被改变。 前面提到过，编译器和处理器可能会对操作做重排序。编译器和处理器在重排序时，会遵 守数据依赖性，编译器和处理器不会改变存在数据依赖关系的两个操作的执行顺序。 这里所说的数据依赖性仅针对单个处理器中执行的指令序列和单个线程中执行的操作， 不同处理器之间和不同线程之间的数据依赖性不被编译器和处理器考虑。

#### 3.2.2　as-if-serial语义

as-if-serial语义的意思是：不管怎么重排序（编译器和处理器为了提高并行度），（单线程） 程序的执行结果不能被改变。编译器、runtime和处理器都必须遵守as-if-serial语义。

为了遵守as-if-serial语义，编译器和处理器不会对存在数据依赖关系的操作做重排序，因为这种重排序会改变执行结果。但是，如果操作之间不存在数据依赖关系，这些操作就可能被编译器和处理器重排序。

as-if-serial语义把单线程程序保护了起来，遵守as-if-serial语义的编译器、runtime和处理器 共同为编写单线程程序的程序员创建了一个幻觉：单线程程序是按程序的顺序来执行的。asif-serial语义使单线程程序员无需担心重排序会干扰他们，也无需担心内存可见性问题。

#### 3.2.3　程序顺序规则

根据happens-before的程序顺序规则，上面计算圆的面积的示例代码存在3个happensbefore关系。

1）A　happens-before B。

 2）B　happens-before C。

 3）A　happens-before C。

 这里的第3个happens-before关系，是根据happens-before的传递性推导出来的。

这里A happens-before B，但实际执行时B却可以排在A之前执行（看上面的重排序后的执行顺序）。如果A happens-before B，JMM并不要求A一定要在B之前执行。JMM仅仅要求前一个 操作（执行的结果）对后一个操作可见，且前一个操作按顺序排在第二个操作之前。这里操作A 的执行结果不需要对操作B可见；而且重排序操作A和操作B后的执行结果，与操作A和操作B 按happens-before顺序执行的结果一致。在这种情况下，JMM会认为这种重排序并不非法（not illegal），JMM允许这种重排序。

在计算机中，软件技术和硬件技术有一个共同的目标：在不改变程序执行结果的前提下， 尽可能提高并行度。编译器和处理器遵从这一目标，从happens-before的定义我们可以看出， JMM同样遵从这一目标。

#### 3.2.4　重排序对多线程的影响

在单线程程序中，对存在控制依赖的操作重排序，不会改变执行结果（这也是as-if-serial 语义允许对存在控制依赖的操作做重排序的原因）；但在多线程程序中，对存在控制依赖的操 作重排序，可能会改变程序的执行结果。

### 3.3　顺序一致性

顺序一致性模型中，所有操作完全按程序的顺序串行执行。而在JMM中，临界区内的代码可以重排序（但JMM不允许临界区内的代码“逸出”到临界区之外，那样会破坏监视器的语义）。

JMM会在退出临界区和进入临界区这两个关键时间点做一些特别处理，使得线程在这两个时间点具有与顺序一致性模型相同的内存视图（具体细节后文会说明）。虽然线程A在临界区内做了重排序，但由于监视器互斥执行的特性，这里的线程B根本无法“观察”到线程A在临界区内的重排序。这种重排序既提高了执行效率，又没有改变程序的执行结果。

对于未同步或未正确同步的多线程程序，JMM只提供最小安全性：线程执行时读取到的 值，要么是之前某个线程写入的值，要么是默认值（0，Null，False），JMM保证线程读操作读取 到的值不会无中生有的冒出来。为了实现最小安全性，JVM在堆上分配对象时，首先会对内存空间进行清零，然后才会在上面分配对象（JVM内部会同步这两个操作）。因 此，在已清零的内存空间（Pre-zeroed Memory）分配对象时，域的默认初始化已经完成了。

### 3.4　volatile的内存语义

简而言之，volatile变量自身具有下列特性。

可见性：对一个volatile变量的读，总是能看到（任意线程）对这个volatile变量最后的写入。

原子性：对任意单个volatile变量的读/写具有原子性，但类似于volatile++这种复合操作不具有原子性。

volatile写的内存语义如下：当写一个volatile变量时，JMM会把该线程对应的本地内存中的共享变量值刷新到主内存。

volatile读的内存语义如下：当读一个volatile变量时，JMM会把该线程对应的本地内存置为无效。线程接下来将从主 内存中读取共享变量。

为了实现volatile的内存语义，编译器在生成字节码时，会在指令序列中插入内存屏障来 、禁止特定类型的处理器重排序。对于编译器来说，发现一个最优布置来最小化插入屏障的总 数几乎不可能。为此，JMM采取保守策略。下面是基于保守策略的JMM内存屏障插入策略。

在每个volatile写操作的前面插入一个StoreStore屏障，后面插入一个StoreLoad屏障。 

在每个volatile读操作的前面插入一个LoadLoad屏障，后面插入一个LoadStore屏障。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909125826880.png"/>

### 3.5　锁的内存语义

下面对锁释放和锁获取的内存语义做个总结。

线程A释放一个锁，实质上是线程A向接下来将要获取这个锁的某个线程发出了（线程A对共享变量所做修改的）消息。

线程B获取一个锁，实质上是线程B接收了之前某个线程发出的（在释放这个锁之前对共 享变量所做修改的）消息。 

线程A释放锁，随后线程B获取这个锁，这个过程实质上是线程A通过主内存向线程B发 送消息。

#### 3.5.3　锁内存语义的实现

在ReentrantLock中，调用lock()方法获取锁；调用unlock()方法释放锁。

 ReentrantLock的实现依赖于Java同步器框架AbstractQueuedSynchronizer（本文简称之为 AQS）。AQS使用一个整型的volatile变量（命名为state）来维护同步状态。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909132128989.png"  />

ReentrantLock分为公平锁和非公平锁，我们首先分析公平锁。

 使用公平锁时，加锁方法lock()调用轨迹如下。 

​	1）ReentrantLock:lock()。 

​	2）FairSync:lock()。 

​	3）AbstractQueuedSynchronizer:acquire(int arg)。 

​	**4）ReentrantLock:tryAcquire(int acquires)。**

在第4步真正开始加锁，下面是该方法的源代码。

```java
protected final boolean tryAcquire(int acquires) {
  final Thread current = Thread.currentThread(); 
  int c = getState(); 
  // 获取锁的开始，首先读volatile变量state 
  if (c == 0) {
    if (isFirst(current) &&
            compareAndSetState(0, acquires)) {
                setExclusiveOwnerThread(current); 
                return true; 
            } 
    } 
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires;
        if (nextc < 0)　　
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true; 
    } 
    return false;
}
```

从上面源代码中我们可以看出，**加锁方法首先读volatile变量state。** 

在使用公平锁时，解锁方法unlock()调用轨迹如下。 

 1）ReentrantLock:unlock()。

 2）AbstractQueuedSynchronizer:release(int arg)。

 **3）Sync:tryRelease(int releases)。**

 在第3步真正开始释放锁，下面是该方法的源代码。

```java
protected final boolean tryRelease(int releases) {
        int c = getState() - releases;
        if (Thread.currentThread() != getExclusiveOwnerThread())
            throw new IllegalMonitorStateException();
        boolean free = false;
        if (c == 0) {
            free = true;
            setExclusiveOwnerThread(null);
        }
        setState(c);　　　　　// 释放锁的最后，写volatile变量state 
  			return free;
    }
```

从上面的源代码可以看出，**在释放锁的最后写volatile变量state。**

公平锁在释放锁的最后写volatile变量state，在获取锁时首先读这个volatile变量。根据 volatile的happens-before规则，释放锁的线程在写volatile变量之前可见的共享变量，在获取锁的线程读取同一个volatile变量后将立即变得对获取锁的线程可见。

现在我们来分析非公平锁的内存语义的实现。非公平锁的释放和公平锁完全一样，所以 这里仅仅分析非公平锁的获取。使用非公平锁时，加锁方法lock()调用轨迹如下。

1）ReentrantLock:lock()。

2）NonfairSync:lock()。

3）AbstractQueuedSynchronizer:compareAndSetState(int expect,int update)。

```java
protected final boolean compareAndSetState(int expect, int update) { 
  return unsafe.compareAndSwapInt(this, stateOffset, expect, update); 
}
```

现在对公平锁和非公平锁的内存语义做个总结。 

公平锁和非公平锁释放时，最后都要写一个volatile变量state。 

公平锁获取时，首先会去读volatile变量。 

非公平锁获取时，首先会用CAS更新volatile变量，这个操作同时具有volatile读和volatile 写的内存语义。

从本文对ReentrantLock的分析可以看出，锁释放-获取的内存语义的实现至少有下面两种方式。 

1）利用volatile变量的写-读所具有的内存语义。 

2）利用CAS所附带的volatile读和volatile写的内存语义。

#### 3.5.4　concurrent包的实现

由于Java的CAS同时具有volatile读和volatile写的内存语义，因此Java线程之间的通信现 在有了下面4种方式。

 1）A线程写volatile变量，随后B线程读这个volatile变量。 

2）A线程写volatile变量，随后B线程用CAS更新这个volatile变量。 

3）A线程用CAS更新一个volatile变量，随后B线程用CAS更新这个volatile变量。 

4）A线程用CAS更新一个volatile变量，随后B线程读这个volatile变量。

同时，volatile变量的读/写和 CAS可以实现线程之间的通信。

把这些特性整合在一起，就形成了整个concurrent包得以实现 的基石。如果我们仔细分析concurrent包的源代码实现，会发现一个通用化的实现模式。 

首先，声明共享变量为volatile。 

然后，使用CAS的原子条件更新来实现线程之间的同步。

 同时，配合以volatile的读/写和CAS所具有的volatile读和写的内存语义来实现线程之间的通信。

 AQS，非阻塞数据结构和原子变量类（java.util.concurrent.atomic包中的类），这些concurrent 包中的基础类都是使用这种模式来实现的，而concurrent包中的高层类又是依赖于这些基础类来实现的。从整体来看，concurrent包的实现示意图如3-28所示。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909132635649.png" />

### 3.6　final域的内存语义

#### 3.6.1　final域的重排序规则

对于final域，编译器和处理器要遵守两个重排序规则。 

1）在构造函数内对一个final域的写入，与随后把这个被构造对象的引用赋值给一个引用变量，这两个操作之间不能重排序。 

2）初次读一个包含final域的对象的引用，与随后初次读这个final域，这两个操作之间不能重排序。

通过为final域增加写和读重排序规则，可以为Java程序员提供初始化安全保证。

只要对象是正确构造的（被构造对象的引用在构造函数中没有“逸出”），那么不需要使用同步（指lock和volatile的使用）就可以保证任意线程都能看到这个final域在构造函数中被初始化之后的值。

### 3.7　happens-before

happens-before是JMM最核心的概念。《JSR-133:Java Memory Model and Thread Specification》对happens-before关系的定义如下。

1）如果一个操作happens-before另一个操作，那么第一个操作的执行结果将对第二个操作 可见，而且第一个操作的执行顺序排在第二个操作之前。

2）两个操作之间存在happens-before关系，并不意味着Java平台的具体实现必须要按照 happens-before关系指定的顺序来执行。如果重排序之后的执行结果，与按happens-before关系 来执行的结果一致，那么这种重排序并不非法（也就是说，JMM允许这种重排序）。

上面的1）是JMM对程序员的承诺。从程序员的角度来说，可以这样理解happens-before关 系：如果A happens-before B，那么Java内存模型将向程序员保证——A操作的结果将对B可见， 且A的执行顺序排在B之前。注意，这只是Java内存模型向程序员做出的保证！

上面的2）是JMM对编译器和处理器重排序的约束原则。正如前面所言，JMM其实是在遵 循一个基本原则：只要不改变程序的执行结果（指的是单线程程序和正确同步的多线程程序）， 编译器和处理器怎么优化都行。JMM这么做的原因是：程序员对于这两个操作是否真的被重 排序并不关心，程序员关心的是程序执行时的语义不能被改变（即执行结果不能被改变）。因 此，happens-before关系本质上和as-if-serial语义是一回事。

·as-if-serial语义保证单线程内程序的执行结果不被改变，happens-before关系保证正确同 步的多线程程序的执行结果不被改变。

·as-if-serial语义给编写单线程程序的程序员创造了一个幻境：单线程程序是按程序的顺序来执行的。happens-before关系给编写正确同步的多线程程序的程序员创造了一个幻境：正确同步的多线程程序是按happens-before指定的顺序来执行的。

as-if-serial语义和happens-before这么做的目的，都是为了在不改变程序执行结果的前提 下，尽可能地提高程序执行的并行度。

《JSR-133:Java Memory Model and Thread Specification》定义了如下happens-before规则。

1）程序顺序规则：一个线程中的每个操作，happens-before于该线程中的任意后续操作。 

2）监视器锁规则：对一个锁的解锁，happens-before于随后对这个锁的加锁。 

3）volatile变量规则：对一个volatile域的写，happens-before于任意后续对这个volatile域的读。

4）传递性：如果A happens-before B，且B happens-before C，那么A happens-before C。

5）start()规则：如果线程A执行操作ThreadB.start()（启动线程B），那么A线程的 ThreadB.start()操作happens-before于线程B中的任意操作。

6）join()规则：如果线程A执行操作ThreadB.join()并成功返回，那么线程B中的任意操作 happens-before于线程A从ThreadB.join()操作成功返回。

### 3.8　双重检查锁定与延迟初始化

在Java程序中，有时候可能需要推迟一些高开销的对象初始化操作，并且只有在使用这些 对象时才进行初始化。此时，程序员可能会采用延迟初始化。但要正确实现线程安全的延迟初 始化需要一些技巧，否则很容易出现问题。比如，下面是非线程安全的延迟初始化对象的示例代码。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909140859494.png" />

在UnsafeLazyInitialization类中，假设A线程执行代码1的同时，B线程执行代码2。此时线程A可能会看到instance引用的对象还没有完成初始化。

对于UnsafeLazyInitialization类，我们可以对getInstance()方法做同步处理来实现线程安全的延迟初始化。示例代码如下。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909141058886.png"/>

由于对getInstance()方法做了同步处理，synchronized将导致性能开销。如果getInstance()方 法被多个线程频繁的调用，将会导致程序执行性能的下降。反之，如果getInstance()方法不会被 多个线程频繁的调用，那么这个延迟初始化方案将能提供令人满意的性能。

在早期的JVM中，synchronized（甚至是无竞争的synchronized）存在巨大的性能开销。因此， 人们想出了一个“聪明”的技巧：双重检查锁定（Double-Checked Locking）。人们想通过双重检查 锁定来降低同步的开销。下面是使用双重检查锁定来实现延迟初始化的示例代码。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909141146231.png" />

如上面代码所示，如果第一次检查instance不为null，那么就不需要执行下面的加锁和初始 化操作。因此，可以大幅降低synchronized带来的性能开销。上面代码表面上看起来，似乎两全 其美。

·多个线程试图在同一时间创建对象时，会通过加锁来保证只有一个线程能创建对象。

·在对象创建好之后，执行getInstance()方法将不需要获取锁，直接返回已创建好的对象。

双重检查锁定看起来似乎很完美，但这是一个错误的优化！在线程执行到第4行，代码读 取到instance不为null时，instance引用的对象有可能还没有完成初始化。

前面的双重检查锁定示例代码的第7行（instance=new Singleton();）创建了一个对象。这一 行代码可以分解为如下的3行伪代码。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909141227479.png" />

上面3行伪代码中的2和3之间，可能会被重排序（在一些JIT编译器上，这种重排序是真实 发生的，详情见参考文献1的“Out-of-order writes”部分）。2和3之间重排序之后的执行时序如下。

![image-20210909141253401](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909141253401.png)

所有 线程在执行Java程序时必须要遵守intra-thread semantics。intra-thread semantics保证重排序不会 改变单线程内的程序执行结果。换句话说，intra-thread semantics允许那些在单线程内，不会改 变单线程程序执行结果的重排序。上面3行伪代码的2和3之间虽然被重排序了，但这个重排序 并不会违反intra-thread semantics。这个重排序在没有改变单线程程序执行结果的前提下，可以 提高程序的执行性能。

回到本文的主题，DoubleCheckedLocking示例代码的第7行（instance=new Singleton();）如果 发生重排序，另一个并发执行的线程B就有可能在第4行判断instance不为null。线程B接下来将 访问instance所引用的对象，但此时这个对象可能还没有被A线程初始化。

在知晓了问题发生的根源之后，我们可以想出两个办法来实现线程安全的延迟初始化。

 1）不允许2和3重排序。

 2）允许2和3重排序，但不允许其他线程“看到”这个重排序。

#### 3.8.3　基于volatile的解决方案

对于前面的基于双重检查锁定来实现延迟初始化的方案（指DoubleCheckedLocking示例代码），只需要做一点小的修改（把instance声明为volatile型），就可以实现线程安全的延迟初始化。请看下面的示例代码。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909141627975.png"  />

#### 3.8.4　基于类初始化的解决方案

JVM在类的初始化阶段（即在Class被加载后，且被线程使用之前），会执行类的初始化。在 执行类的初始化期间，JVM会去获取一个锁。这个锁可以同步多个线程对同一个类的初始化。

基于这个特性，可以实现另一种线程安全的延迟初始化方案。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909141805634.png"  />

假设两个线程并发执行getInstance()方法，下面是执行的示意图，如图3-40所示。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909141829912.png" />

这个方案的实质是：允许3.8.2节中的3行伪代码中的2和3重排序，但不允许非构造线程（这 里指线程B）“看到”这个重排序。

初始化一个类，包括执行这个类的静态初始化和初始化在这个类中声明的静态字段。根据Java语言规范，在首次发生下列任意一种情况时，一个类或接口类型T将被立即初始化。 

1）T是一个类，而且一个T类型的实例被创建。 

2）T是一个类，且T中声明的一个静态方法被调用。 

3）T中声明的一个静态字段被赋值。 

4）T中声明的一个静态字段被使用，而且这个字段不是一个常量字段。 

5）T是一个顶级类（Top Level Class，见Java语言规范的§7.6），而且一个断言语句嵌套在T 内部被执行。

在InstanceFactory示例代码中，首次执行getInstance()方法的线程将导致InstanceHolder类被 初始化（符合情况4）。

由于Java语言是多线程的，多个线程可能在同一时间尝试去初始化同一个类或接口（比如 这里多个线程可能在同一时刻调用getInstance()方法来初始化InstanceHolder类）。因此，在Java 中初始化一个类或者接口时，需要做细致的同步处理。

Java语言规范规定，对于每一个类或接口C，都有一个唯一的初始化锁LC与之对应。从C 到LC的映射，由JVM的具体实现去自由实现。JVM在类初始化期间会获取这个初始化锁，并且 每个线程至少获取一次锁来确保这个类已经被初始化过了（事实上，Java语言规范允许JVM的 具体实现在这里做一些优化，见后文的说明）。

对于类或接口的初始化，Java语言规范制定了精巧而复杂的类初始化处理过程。Java初始 化一个类或接口的处理过程如下（这里对类初始化处理过程的说明，省略了与本文无关的部 分；同时为了更好的说明类初始化过程中的同步处理机制，笔者人为的把类初始化的处理过程 分为了5个阶段）。

第1阶段：通过在Class对象上同步（即获取Class对象的初始化锁），来控制类或接口的初始化。这个获取锁的线程会一直等待，直到当前线程能够获取到这个初始化锁。

第2阶段：线程A执行类的初始化，同时线程B在初始化锁对应的condition上等待。

第3阶段：线程A设置state=initialized，然后唤醒在condition中等待的所有线程。

第4阶段：线程B结束类的初始化处理。

第5阶段：线程C执行类的初始化的处理。

通过对比基于volatile的双重检查锁定的方案和基于类初始化的方案，我们会发现基于类 初始化的方案的实现代码更简洁。但基于volatile的双重检查锁定的方案有一个额外的优势： 除了可以对静态字段实现延迟初始化外，还可以对实例字段实现延迟初始化。 字段延迟初始化降低了初始化类或创建实例的开销，但增加了访问被延迟初始化的字段 的开销。在大多数时候，正常的初始化要优于延迟初始化。如果确实需要对实例字段使用线程 安全的延迟初始化，请使用上面介绍的基于volatile的延迟初始化的方案；如果确实需要对静 态字段使用线程安全的延迟初始化，请使用上面介绍的基于类初始化的方案。

### 3.9　Java内存模型综述

顺序一致性内存模型是一个理论参考模型，JMM和处理器内存模型在设计时通常会以顺 序一致性内存模型为参照。在设计时，JMM和处理器内存模型会对顺序一致性模型做一些放 松，因为如果完全按照顺序一致性模型来实现处理器和JMM，那么很多的处理器和编译器优 化都要被禁止，这对执行性能将会有很大的影响。

按程序类型，Java程序的内存可见性保证可以分为下列3类。

·单线程程序。单线程程序不会出现内存可见性问题。编译器、runtime和处理器会共同确 保单线程程序的执行结果与该程序在顺序一致性模型中的执行结果相同。

·正确同步的多线程程序。正确同步的多线程程序的执行将具有顺序一致性（程序的执行 结果与该程序在顺序一致性内存模型中的执行结果相同）。这是JMM关注的重点，JMM通过限 制编译器和处理器的重排序来为程序员提供内存可见性保证。

·未同步/未正确同步的多线程程序。JMM为它们提供了最小安全性保障：线程执行时读取 到的值，要么是之前某个线程写入的值，要么是默认值（0、null、false）。

## 第4章　Java并发编程基础

### 4.1　线程简介

#### 4.1.1　什么是线程

现代操作系统调度的最小单元是线程，在一个进程里可以创建多个线程，这些线程都拥有各自的计数器、堆栈和局 部变量等属性，并且能够访问共享的内存变量。处理器在这些线程上高速切换，让使用者感觉 到这些线程在同时执行。

使用JMX来查看一个普通的Java程序包含哪些线程.

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909143553247.png" />

输出内容如下：

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909143703950.png" />

可以看到，一个Java程序的运行不仅仅是main()方法的运行，而是main线程和多个其他线 程的同时运行。

#### 4.1.2　为什么要使用多线程

更多的处理器核心、更快的响应时间、更好的编程模型

#### 4.1.3　线程优先级

现代操作系统基本采用时分的形式调度运行的线程，操作系统会分出一个个时间片，线 程会分配到若干时间片，当线程的时间片用完了就会发生线程调度，并等待着下次分配。线程 分配到的时间片多少也就决定了线程使用处理器资源的多少，而线程优先级就是决定线程需 要多或者少分配一些处理器资源的线程属性。

在Java线程中，通过一个整型成员变量priority来控制优先级，优先级的范围从1~10，在线 程构建的时候可以通过setPriority(int)方法来修改优先级，默认优先级是5，优先级高的线程分 配时间片的数量要多于优先级低的线程。设置线程优先级时，针对频繁阻塞（休眠或者I/O操 作）的线程需要设置较高优先级，而偏重计算（需要较多CPU时间或者偏运算）的线程则设置较低的优先级，确保处理器不会被独占。

从输出可以看到线程优先级没有生效，优先级1和优先级10的Job计数的结果非常相近， 没有明显差距。这表示程序正确性不能依赖线程的优先级高低。线程优先级不能作为程序正确性的依赖，因为操作系统可以完全不用理会Java 线程对于优先级的设定。

## 第5章　Java中的锁

### 5.1　Lock接口

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909144922492.png" />

### 5.2　队列同步器

队列同步器AbstractQueuedSynchronizer（以下简称AQS），是用来构建锁或者其他同步组件的基础框架，它使用了一个int成员变量表示同步状态，通过内置的FIFO队列来完成资源获取线程的排队工作。

AQS的主要使用方式是继承，子类通过继承同步器并实现它的抽象方法来管理同步状态，在抽象方法的实现过程中免不了要对同步状态进行更改，这时就需要使用同步器提供的3个方法（getState()、setState(int newState)和compareAndSetState(int expect,int update)）来进行操作，因为它们能够保证状态的改变是安全的。

子类推荐被定义为自定义同步组件的静态内部类，同步器自身没有实现任何同步接口，它仅仅是定义了若干同步状态获取和释放的方法来供自定义同步组件使用，同步器既可以支持独占式地获取同步状态，也可以支持共享式地获 取同步状态，这样就可以方便实现不同类型的同步组件（ReentrantLock、 ReentrantReadWriteLock和CountDownLatch等）。

### 5.3　重入锁

重进入是指任意线程在获取到锁之后能够再次获取该锁而不会被锁所阻塞，该特性的实 现需要解决以下两个问题。

##### 1.实现重进入

1）线程再次获取锁。锁需要去识别获取锁的线程是否为当前占据锁的线程，如果是，则再 次成功获取。

2）锁的最终释放。线程重复n次获取了锁，随后在第n次释放该锁后，其他线程能够获取到 该锁。锁的最终释放要求锁对于获取进行计数自增，计数表示当前锁被重复获取的次数，而锁 被释放时，计数自减，当计数等于0时表示锁已经成功释放。

如果该锁被获取了n次，那么前(n-1)次tryRelease(int releases)方法必须返回false，而只有同步状态完全释放了，才能返回true。可以看到，该方法将同步状态是否为0作为最终释放的条 件，当同步状态为0时，将占有线程设置为null，并返回true，表示释放成功。

##### 2.公平与非公平获取锁的区别

公平性与否是针对获取锁而言的，如果一个锁是公平的，那么锁的获取顺序就应该符合 请求的绝对时间顺序，也就是FIFO。

回顾上一小节中介绍的nonfairTryAcquire(int acquires)方法，对于非公平锁，只要CAS设置 同步状态成功，则表示当前线程获取了锁，而公平锁则不同，该方法与nonfairTryAcquire(int acquires)比较，唯一不同的位置为判断条件多了 hasQueuedPredecessors()方法，即加入了同步队列中当前节点是否有前驱节点的判断，如果该 方法返回true，则表示有线程比当前线程更早地请求获取锁，因此需要等待前驱线程获取并释 放锁之后才能继续获取锁。

在测试中公平性锁与非公平性锁相比，总耗时是其94.3倍，总切换次数是其133倍。可以 看出，公平性锁保证了锁的获取按照FIFO原则，而代价是进行大量的线程切换。非公平性锁虽 然可能造成线程“饥饿”，但极少的线程切换，保证了其更大的吞吐量。

### 5.4　读写锁

之前提到锁（如Mutex和ReentrantLock）基本都是排他锁，这些锁在同一时刻只允许一个线程进行访问，而读写锁在同一时刻可以允许多个读线程访问，但是在写线程访问时，所有的读 线程和其他写线程均被阻塞。读写锁维护了一对锁，一个读锁和一个写锁，通过分离读锁和写 锁，使得并发性相比一般的排他锁有了很大提升。

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909150041398.png" />

##### 1.读写状态的设计

读写锁同样依赖自定义同步器来实现同步功能，而读写状态就是其同步器的同步状态。 回想ReentrantLock中自定义同步器的实现，同步状态表示锁被一个线程重复获取的次数，而读 写锁的自定义同步器需要在同步状态（一个整型变量）上维护多个读线程和一个写线程的状 态，使得该状态的设计成为读写锁实现的关键。

如果在一个整型变量上维护多种状态，就一定需要“按位切割使用”这个变量，读写锁将 变量切分成了两个部分，高16位表示读，低16位表示写。

写锁是一个支持重进入的排它锁，读锁是一个支持重进入的共享锁。

##### 4.锁降级

锁降级指的是写锁降级成为读锁。如果当前线程拥有写锁，然后将其释放，最后再获取读 锁，这种分段完成的过程不能称之为锁降级。锁降级是指把持住（当前拥有的）写锁，再获取到 读锁，随后释放（先前拥有的）写锁的过程。

### 5.5　LockSupport工具

LockSupport定义了一组以park开头的方法用来阻塞当前线程，以及unpark(Thread thread) 方法来唤醒一个被阻塞的线程。

![image-20211011154934093](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20211011154934093.png)

### 5.6　Condition接口

任意一个Java对象，都拥有一组监视器方法（定义在java.lang.Object上），主要包括wait()、 wait(long timeout)、notify()以及notifyAll()方法，这些方法与synchronized同步关键字配合，可以 实现等待/通知模式。Condition接口也提供了类似Object的监视器方法，与Lock配合可以实现等 待/通知模式，但是这两者在使用方式以及功能特性上还是有差别的。 

<img src="https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909150306528.png" alt="image-20210909150306528" style="zoom:50%;" />

Condition定义了等待/通知两种类型的方法，当前线程调用这些方法时，需要提前获取到 Condition对象关联的锁。Condition对象是由Lock对象（调用Lock对象的newCondition()方法）创 建出来的，换句话说，Condition是依赖Lock对象的。

等待队列是一个FIFO的队列，在队列中的每个节点都包含了一个线程引用，该线程就是 在Condition对象上等待的线程，如果一个线程调用了Condition.await()方法，那么该线程将会 释放锁、构造成节点加入等待队列并进入等待状态。事实上，节点的定义复用了同步器中节点 的定义，也就是说，同步队列和等待队列中节点类型都是同步器的静态内部类 AbstractQueuedSynchronizer.Node。

一个Condition包含一个等待队列，Condition拥有首节点（firstWaiter）和尾节点 （lastWaiter）。当前线程调用Condition.await()方法，将会以当前线程构造节点，并将节点从尾部 加入等待队列，等待队列的基本结构如图5-9所示。

![image-20210909150552225](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/image-20210909150552225.png)

如图所示，Condition拥有首尾节点的引用，而新增节点只需要将原有的尾节点nextWaiter 指向它，并且更新尾节点即可。上述节点引用更新的过程并没有使用CAS保证，原因在于调用 await()方法的线程必定是获取了锁的线程，也就是说该过程是由锁来保证线程安全的。 

调用Condition的await()方法（或者以await开头的方法），会使当前线程进入等待队列并释 放锁，同时线程状态变为等待状态。当从await()方法返回时，当前线程一定获取了Condition相 关联的锁。 如果从队列（同步队列和等待队列）的角度看await()方法，当调用await()方法时，相当于同 步队列的首节点（获取了锁的节点）移动到Condition的等待队列中。

调用Condition的signal()方法，将会唤醒在等待队列中等待时间最长的节点（首节点），在 唤醒节点之前，会将节点移到同步队列中。

Condition的signalAll()方法，相当于对等待队列中的每个节点均执行一次signal()方法，效果就是将等待队列中所有节点全部移动到同步队列中，并唤醒每个节点的线程。

## 第6章　Java并发容器和框架

#### 6.2　ConcurrentLinkedQueue

在并发编程中，有时候需要使用线程安全的队列。如果要实现一个线程安全的队列有两 种方式：一种是使用阻塞算法，另一种是使用非阻塞算法。使用阻塞算法的队列可以用一个锁 （入队和出队用同一把锁）或两个锁（入队和出队用不同的锁）等方式来实现。非阻塞的实现方 式则可以使用循环CAS的方式来实现。

### 6.3　Java中的阻塞队列

阻塞队列（BlockingQueue）是一个支持两个附加操作的队列。这两个附加的操作支持阻塞 的插入和移除方法。

1）支持阻塞的插入方法：意思是当队列满时，队列会阻塞插入元素的线程，直到队列不满。

 2）支持阻塞的移除方法：意思是在队列为空时，获取元素的线程会等待队列变为非空。

阻塞队列常用于生产者和消费者的场景，生产者是向队列里添加元素的线程，消费者是 从队列里取元素的线程。阻塞队列就是生产者用来存放元素、消费者用来获取元素的容器。

JDK 7提供了7个阻塞队列，如下。 

ArrayBlockingQueue：一个由数组结构组成的有界阻塞队列。 

LinkedBlockingQueue：一个由链表结构组成的有界阻塞队列。 

PriorityBlockingQueue：一个支持优先级排序的无界阻塞队列。 

DelayQueue：一个使用优先级队列实现的无界阻塞队列。 

SynchronousQueue：一个不存储元素的阻塞队列。 

LinkedTransferQueue：一个由链表结构组成的无界阻塞队列。 

LinkedBlockingDeque：一个由链表结构组成的双向阻塞队列。

## 第7章　Java中的13个原子操作类

| 类型               | 名称                                                         | 常用方法                                                     |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 原子更新基本类型类 | AtomicBoolean、AtomicInteger、AtomicLong                     | int addAndGet（int delta）；boolean compareAndSet（int expect，int update）；int getAndIncrement();void lazySet（int newValue） |
| 原子更新数组       | AtomicIntegerArray、AtomicLongArray、AtomicReferenceArray、AtomicIntegerArray | 操作与原理同上                                               |
| 原子更新引用类型   | AtomicReference、AtomicReferenceFieldUpdate、AtomicMarkableReference | 操作与原理同上                                               |
| 原子更新字段类     | AtomicIntegerFieldUpdater、AtomicLongFieldUpdater、AtomicStampedReference | 操作与原理同上                                               |

## 第8章　Java中的并发工具类

CountDownLatch允许一个或多个线程等待其他线程完成操作。

CyclicBarrier的字面意思是可循环使用（Cyclic）的屏障（Barrier）。它要做的事情是，让一组线程到达一个屏障（也可以叫同步点）时被阻塞，直到最后一个线程到达屏障时，屏障才会 开门，所有被屏障拦截的线程才会继续运行。

Semaphore（信号量）是用来控制同时访问特定资源的线程数量，它通过协调各个线程，以 保证合理的使用公共资源。

Exchanger（交换者）是一个用于线程间协作的工具类。Exchanger用于进行线程间的数据交 换。它提供一个同步点，在这个同步点，两个线程可以交换彼此的数据。这两个线程通过 exchange方法交换数据，如果第一个线程先执行exchange()方法，它会一直等待第二个线程也 执行exchange方法，当两个线程都到达同步点时，这两个线程就可以交换数据，将本线程生产 出来的数据传递给对方。

### 第9章　Java中的线程池

Java中的线程池是运用场景最多的并发框架，几乎所有需要异步或并发执行任务的程序 都可以使用线程池。在开发过程中，合理地使用线程池能够带来3个好处。 

第一：降低资源消耗。通过重复利用已创建的线程降低线程创建和销毁造成的消耗。 

第二：提高响应速度。当任务到达时，任务可以不需要等到线程创建就能立即执行。 

第三：提高线程的可管理性。线程是稀缺资源，如果无限制地创建，不仅会消耗系统资源， 还会降低系统的稳定性，使用线程池可以进行统一分配、调优和监控。但是，要做到合理利用 线程池，必须对其实现原理了如指掌。

<img src="/Users/mbpzy/images/image-20210909195111181.png" alt="image-20210909195111181" style="zoom:50%;" />

创建一个线程池时需要输入几个参数，如下。

**1）corePoolSize（线程池的基本大小）**：当提交一个任务到线程池时，线程池会创建一个线 程来执行任务，即使其他空闲的基本线程能够执行新任务也会创建线程，等到需要执行的任 务数大于线程池基本大小时就不再创建。如果调用了线程池的prestartAllCoreThreads()方法， 线程池会提前创建并启动所有基本线程。

**2）runnableTaskQueue（任务队列）**：用于保存等待执行的任务的阻塞队列。可以选择以下几 个阻塞队列。

·ArrayBlockingQueue：是一个基于数组结构的有界阻塞队列，此队列按FIFO（先进先出）原 则对元素进行排序。

·LinkedBlockingQueue：一个基于链表结构的阻塞队列，此队列按FIFO排序元素，吞吐量通 常要高于ArrayBlockingQueue。静态工厂方法Executors.newFixedThreadPool()使用了这个队列。

·SynchronousQueue：一个不存储元素的阻塞队列。每个插入操作必须等到另一个线程调用 移除操作，否则插入操作一直处于阻塞状态，吞吐量通常要高于Linked-BlockingQueue，静态工 厂方法Executors.newCachedThreadPool使用了这个队列。

·PriorityBlockingQueue：一个具有优先级的无限阻塞队列。 

**3）maximumPoolSize（线程池最大数量）**：线程池允许创建的最大线程数。如果队列满了，并 且已创建的线程数小于最大线程数，则线程池会再创建新的线程执行任务。值得注意的是，如 果使用了无界的任务队列这个参数就没什么效果。

**4）ThreadFactory**：用于设置创建线程的工厂，可以通过线程工厂给每个创建出来的线程设 置更有意义的名字。使用开源框架guava提供的ThreadFactoryBuilder可以快速给线程池里的线 程设置有意义的名字，代码如下。

**5）RejectedExecutionHandler（饱和策略）**：当队列和线程池都满了，说明线程池处于饱和状 态，那么必须采取一种策略处理提交的新任务。这个策略默认情况下是AbortPolicy，表示无法 处理新任务时抛出异常。在JDK 1.5中Java线程池框架提供了以下4种策略。

·AbortPolicy：直接抛出异常。

·CallerRunsPolicy：只用调用者所在线程来运行任务。

·DiscardOldestPolicy：丢弃队列里最近的一个任务，并执行当前任务。

·DiscardPolicy：不处理，丢弃掉。

**6）keepAliveTime（线程活动保持时间）**：线程池的工作线程空闲后，保持存活的时间。所以， 如果任务很多，并且每个任务执行的时间比较短，可以调大时间，提高线程的利用率。

**7）TimeUnit（线程活动保持时间的单位）**：可选的单位有天（DAYS）、小时（HOURS）、分钟（MINUTES）、毫秒（MILLISECONDS）、微秒（MICROSECONDS，千分之一毫秒）和纳秒 （NANOSECONDS，千分之一微秒）。



#### 9.2.2　向线程池提交任务

execute()方法用于提交不需要返回值的任务，所以无法判断任务是否被线程池执行成功。

submit()方法用于提交需要返回值的任务。线程池会返回一个future类型的对象，通过这个 future对象可以判断任务是否执行成功，并且可以通过future的get()方法来获取返回值，get()方 法会阻塞当前线程直到任务完成，而使用get（long timeout，TimeUnit unit）方法则会阻塞当前线 程一段时间后立即返回，这时候有可能任务没有执行完。

#### 9.2.3　关闭线程池

可以通过调用线程池的shutdown或shutdownNow方法来关闭线程池。它们的原理是遍历线 程池中的工作线程，然后逐个调用线程的interrupt方法来中断线程，所以无法响应中断的任务 可能永远无法终止。但是它们存在一定的区别，shutdownNow首先将线程池的状态设置成 STOP，然后尝试停止所有的正在执行或暂停任务的线程，并返回等待执行任务的列表，而 shutdown只是将线程池的状态设置成SHUTDOWN状态，然后中断所有没有正在执行任务的线程。

只要调用了这两个关闭方法中的任意一个，isShutdown方法就会返回true。当所有的任务 都已关闭后，才表示线程池关闭成功，这时调用isTerminaed方法会返回true。至于应该调用哪 一种方法来关闭线程池，应该由提交到线程池的任务特性决定，通常调用shutdown方法来关闭 线程池，如果任务不一定要执行完，则可以调用shutdownNow方法。

## 第10章　Executor框架

#### 1.Executor框架的结构

Executor框架主要由3大部分组成如下。 

任务。包括被执行任务需要实现的接口：Runnable接口或Callable接口。 

任务的执行。包括任务执行机制的核心接口Executor，以及继承自Executor的 ExecutorService接口。Executor框架有两个关键类实现了ExecutorService接口 （ThreadPoolExecutor和ScheduledThreadPoolExecutor）。 

异步计算的结果。包括接口Future和实现Future接口的FutureTask类。

#### 10.2.1　FixedThreadPool详解

FixedThreadPool被称为可重用固定线程数的线程池。FixedThreadPool的corePoolSize和maximumPoolSize都被设置为创建FixedThreadPool时指定的参数nThreads。

当线程池中的线程数大于corePoolSize时，keepAliveTime为多余的空闲线程等待新任务的最长时间，超过这个时间后多余的线程将被终止。这里把keepAliveTime设置为0L，意味着多余的空闲线程会被立即终止。由于使用无界队列LinkedBlockingQueue，运行中的FixedThreadPool（未执行方法shutdown()或 shutdownNow()）不会拒绝任务（不会调用RejectedExecutionHandler.rejectedExecution方法）。

#### 10.2.2　SingleThreadExecutor详解

SingleThreadExecutor是使用单个worker线程的Executor。SingleThreadExecutor的corePoolSize和maximumPoolSize被设置为1。其他参数与 FixedThreadPool相同。SingleThreadExecutor使用无界队列LinkedBlockingQueue作为线程池的工作队列（队列的容量为Integer.MAX_VALUE）。

#### 10.2.3　CachedThreadPool详解

CachedThreadPool是一个会根据需要创建新线程的线程池。CachedThreadPool的corePoolSize被设置为0，即corePool为空；maximumPoolSize被设置为 Integer.MAX_VALUE，即maximumPool是无界的。这里把keepAliveTime设置为60L，意味着 CachedThreadPool中的空闲线程等待新任务的最长时间为60秒，空闲线程超过60秒后将会被 终止。

FixedThreadPool和SingleThreadExecutor使用无界队列LinkedBlockingQueue作为线程池的工作队列。CachedThreadPool使用没有容量的SynchronousQueue作为线程池的工作队列，但 CachedThreadPool的maximumPool是无界的。这意味着，如果主线程提交任务的速度高于 maximumPool中线程处理任务的速度时，CachedThreadPool会不断创建新线程。极端情况下， CachedThreadPool会因为创建过多线程而耗尽CPU和内存资源。
