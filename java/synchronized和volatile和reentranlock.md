# 1.synchronized和ReentrantLock的区别

## 回顾一下两个关键字：synchronized和volatile

1、Java语言为了解决并发编程中存在的原子性、可见性和有序性问题，提供了一系列和并发处理相关的关键字，比如synchronized、volatile、final、concurren包等。

2、synchronized通过加锁的方式，使得其在需要原子性、可见性和有序性这三种特性的时候都可以作为其中一种解决方案，看起来是“万能”的。的确，大部分并发控制操作都能使用synchronized来完成。

3、volatile通过在volatile变量的操作前后插入内存屏障的方式，保证了变量在并发场景下的可见性和有序性。

4、volatile关键字是无法保证原子性的，而synchronized通过monitorenter和monitorexit两个指令，可以保证被synchronized修饰的代码在同一时间只能被一个线程访问，即可保证不会出现CPU时间片在多个线程间切换，即可保证原子性。

那么，我们知道，synchronized和volatile两个关键字是Java并发编程中经常用到的两个关键字，而且，通过前面的回顾，我们知道synchronized可以保证并发编程中不会出现原子性、可见性和有序性问题，而volatile只能保证可见性和有序性，那么，既生synchronized、何生volatile？

接下来，本文就来论述一下，为什么Java中已经有了synchronized关键字，还要提供volatile关键字。

## Synchronized的问题

我们都知道synchronized其实是一种加锁机制，那么既然是锁，天然就具备以下几个缺点：

### 1、有性能损耗

虽然在JDK 1.6中对synchronized做了很多优化，如如适应性自旋、锁消除、锁粗化、轻量级锁和偏向锁等，但是他毕竟还是一种锁。

以上这几种优化，都是尽量想办法避免对Monitor进行加锁，但是，并不是所有情况都可以优化的，况且就算是经过优化，优化的过程也是有一定的耗时的。

所以，无论是使用同步方法还是同步代码块，在同步操作之前还是要进行加锁，同步操作之后需要进行解锁，这个加锁、解锁的过程是要有性能损耗的。

关于二者的性能对比，由于虚拟机对锁实行的许多消除和优化，使得我们很难量化这两者之间的性能差距，但是我们可以确定的一个基本原则是：volatile变量的读操作的性能小号普通变量几乎无差别，但是写操作由于需要插入内存屏障所以会慢一些，即便如此，volatile在大多数场景下也比锁的开销要低。

### 2、产生阻塞

关于synchronize的实现原理，无论是同步方法还是同步代码块，无论是ACC_SYNCHRONIZED还是monitorenter、monitorexit都是基于Monitor实现的。

基于Monitor对象，当多个线程同时访问一段同步代码时，首先会进入Entry Set，当有一个线程获取到对象的锁之后，才能进行The Owner区域，其他线程还会继续在Entry Set等待。并且当某个线程调用了wait方法后，会释放锁并进入Wait Set等待。

![img](/Users/mbpzy/images/16cd3460d383ca42~tplv-t2oaga2asx-watermark.awebp)

所以，synchronize实现的锁本质上是一种阻塞锁，也就是说多个线程要排队访问同一个共享对象。

而volatile是Java虚拟机提供的一种轻量级同步机制，他是基于内存屏障实现的。说到底，他并不是锁，所以他不会有synchronized带来的阻塞和性能损耗的问题。

## volatile的附加功能

除了前面我们提到的volatile比synchronized性能好以外，volatile其实还有一个很好的附加功能，那就是禁止指令重排。

我们先来举一个例子，看一下如果只使用synchronized而不使用volatile会发生什么问题，就拿我们比较熟悉的单例模式来看。

我们通过双重校验锁的方式实现一个单例，这里不使用volatile关键字：

```java
 1   public class Singleton {  
 2      private static Singleton singleton;  
 3       private Singleton (){}  
 4       public static Singleton getSingleton() {  
 5       if (singleton == null) {  
 6           synchronized (Singleton.class) {  
 7               if (singleton == null) {  
 8                   singleton = new Singleton();  
 9               }  
 10           }  
 11       }  
 12       return singleton;  
 13       }  
 14   }  

复制代码
```

以上代码，我们通过使用synchronized对Singleton.class进行加锁，可以保证同一时间只有一个线程可以执行到同步代码块中的内容，也就是说singleton = new Singleton()这个操作只会执行一次，这就是实现了一个单例。

但是，当我们在代码中使用上述单例对象的时候有可能发生空指针异常。这是一个比较诡异的情况。

我们假设Thread1 和 Thread2两个线程同时请求Singleton.getSingleton方法的时候：

![img](/Users/mbpzy/images/16cd3460d481e37b~tplv-t2oaga2asx-watermark.awebp)

- Step1 ,Thread1执行到第8行，开始进行对象的初始化。
- Step2 ,Thread2执行到第5行，判断singleton == null。
- Step3 ,Thread2经过判断发现singleton ！= null，所以执行第12行，返回singleton。
- Step4 ,Thread2拿到singleton对象之后，开始执行后续的操作，比如调用singleton.call()。

以上过程，看上去并没有什么问题，但是，其实，在Step4，Thread2在调用singleton.call()的时候，是有可能抛出空指针异常的。

之所有会有NPE抛出，是因为在Step3，Thread2拿到的singleton对象并不是一个完整的对象。

什么叫做不完整对象，这个怎么理解呢？

我们这里来先来看一下，singleton = new Singleton();这行代码到底做了什么事情，大致过程如下：

- 1、虚拟机遇到new指令，到常量池定位到这个类的符号引用。
- 2、检查符号引用代表的类是否被加载、解析、初始化过。
- 3、虚拟机为对象分配内存。
- 4、虚拟机将分配到的内存空间都初始化为零值。
- 5、虚拟机对对象进行必要的设置。
- 6、执行方法，成员变量进行初始化。
- 7、将对象的引用指向这个内存区域。

我们把这个过程简化一下，简化成3个步骤：

- a、JVM为对象分配一块内存M
- b、在内存M上为对象进行初始化
- c、将内存M的地址复制给singleton变量

如下图：

![img](/Users/mbpzy/images/16cd3460d5816179~tplv-t2oaga2asx-watermark.awebp)

因为将内存的地址赋值给singleton变量是最后一步，所以Thread1在这一步骤执行之前，Thread2在对singleton==null进行判断一直都是true的，那么他会一直阻塞，直到Thread1将这一步骤执行完。

但是，问题就出在以上过程并不是一个原子操作，并且编译器可能会进行重排序，如果以上步骤被重排成：

- a、JVM为对象分配一块内存M
- c、将内存的地址复制给singleton变量
- b、在内存M上为对象进行初始化

如下图：

![img](/Users/mbpzy/images/16cd3460d598334d~tplv-t2oaga2asx-watermark.awebp)

这样的话，Thread1会先执行内存分配，在执行变量赋值，最后执行对象的初始化，那么，也就是说，在Thread1还没有为对象进行初始化的时候，Thread2进来判断singleton==null就可能提前得到一个false，则会返回一个不完整的sigleton对象，因为他还未完成初始化操作。

这种情况一旦发生，我们拿到了一个不完整的singleton对象，当尝试使用这个对象的时候就极有可能发生NPE异常。

那么，怎么解决这个问题呢？因为指令重排导致了这个问题，那就避免指令重排就行了。

所以，volatile就派上用场了，因为volatile可以避免指令重排。只要将代码改成以下代码，就可以解决这个问题：

```java
 1   public class Singleton {  
 2      private volatile static Singleton singleton;  
 3       private Singleton (){}  
 4       public static Singleton getSingleton() {  
 5       if (singleton == null) {  
 6           synchronized (Singleton.class) {  
 7               if (singleton == null) {  
 8                   singleton = new Singleton();  
 9               }  
 10           }  
 11       }  
 12       return singleton;  
 13       }  
 14   }  

复制代码
```

对singleton使用volatile约束，保证他的初始化过程不会被指令重排。这样就可以保Thread2 要不然就是拿不到对象，要不然就是拿到一个完整的对象。

## Synchronized的有序性保证呢？

看到这里可能有朋友会问了，说到底上面问题是发生了指令重排，其实还是个有序性的问题，不是说synchronized是可以保证有序性的么，这里为什么就不行了呢？

首先，可以明确的一点是：synchronized是无法禁止指令重排和处理器优化的。那么他是如何保证的有序性呢？

这就要再把有序性的概念扩展一下了。Java程序中天然的有序性可以总结为一句话：如果在本线程内观察，所有操作都是天然有序的。如果在一个线程中观察另一个线程，所有操作都是无序的。

以上这句话也是《深入理解Java虚拟机》中的原句，但是怎么理解呢？周志明并没有详细的解释。这里我简单扩展一下，这其实和as-if-serial语义有关。

as-if-serial语义的意思指：不管怎么重排序，单线程程序的执行结果都不能被改变。编译器和处理器无论如何优化，都必须遵守as-if-serial语义。

这里不对as-if-serial语义详细展开了，简单说就是，as-if-serial语义保证了单线程中，不管指令怎么重排，最终的执行结果是不能被改变的。

那么，我们回到刚刚那个双重校验锁的例子，站在单线程的角度，也就是只看Thread1的话，因为编译器会遵守as-if-serial语义，所以这种优化不会有任何问题，对于这个线程的执行结果也不会有任何影响。

但是，Thread1内部的指令重排却对Thread2产生了影响。

那么，我们可以说，synchronized保证的有序性是多个线程之间的有序性，即被加锁的内容要按照顺序被多个线程执行。但是其内部的同步代码还是会发生重排序，只不过由于编译器和处理器都遵循as-if-serial语义，所以我们可以认为这些重排序在单线程内部可忽略。

## 总结

本文从两方面论述了volatile的重要性以及不可替代性：

一方面是因为synchronized是一种锁机制，存在阻塞问题和性能问题，而volatile并不是锁，所以不存在阻塞和性能问题。

另外一方面，因为volatile借助了内存屏障来帮助其解决可见性和有序性问题，而内存屏障的使用还为其带来了一个禁止指令重排的附件功能，所以在有些场景中是可以避免发生指令重排的问题的。

所以，在日后需要做并发控制的时候，如果不涉及到原子性的问题，可以优先考虑使用volatile关键字。

# 1.Synchronized和ReentrantLock区别

#### 1.1 相似点：

- 这两种同步方式有很多相似之处，它们都是加锁方式同步，而且都是阻塞式的同步，也就是说当如果一个线程获得了对象锁，进入了同步块，其他访问该同步块的线程都必须阻塞在同步块外面等待，而进行线程阻塞和唤醒的代价是比较高的（操作系统需要在用户态与内核态之间来回切换，代价很高，不过可以通过对锁优化进行改善）。

#### 1.2 区别：

##### 1.2.1 API层面

- 这两种方式最大区别就是对于Synchronized来说，它是java语言的关键字，是原生语法层面的互斥，需要jvm实现。而ReentrantLock它是JDK 1.5之后提供的API层面的互斥锁，需要lock()和unlock()方法配合try/finally语句块来完成。

- synchronized既可以修饰方法，也可以修饰代码块。

  ```java
  //synchronized修饰一个方法时，这个方法叫同步方法。
  public synchronized void test() {
  //方法体``
  
  }
  
  synchronized（Object） {
  //括号中表示需要锁的对象.
  //线程执行的时候会对Object上锁
  }
  复制代码
  ```

- ReentrantLock使用

  ```java
  private ReentrantLock lock = new ReentrantLock();
  public void run() {
      lock.lock();
      try{
          for(int i=0;i<5;i++){
              System.out.println(Thread.currentThread().getName()+":"+i);
          }
      }finally{
          lock.unlock();
      }
  }
  复制代码
  ```

##### 1.2.2 等待可中断

- 等待可中断是指当持有锁的线程长期不释放锁的时候，正在等待的线程可以选择放弃等待，改为处理其他事情。可等待特性对处理执行时间非常长的同步快很有帮助。
- 具体来说，假如业务代码中有两个线程，Thread1 Thread2。假设 Thread1 获取了对象object的锁，Thread2将等待Thread1释放object的锁。
  - 使用synchronized。如果Thread1不释放，Thread2将一直等待，不能被中断。synchronized也可以说是Java提供的原子性内置锁机制。内部锁扮演了互斥锁（mutual exclusion lock ，mutex）的角色，一个线程引用锁的时候，别的线程阻塞等待。
  - 使用ReentrantLock。如果Thread1不释放，Thread2等待了很长时间以后，可以中断等待，转而去做别的事情。

##### 2.2.3 公平锁

- 公平锁是指多个线程在等待同一个锁时，必须按照申请的时间顺序来依次获得锁；而非公平锁则不能保证这一点。非公平锁在锁被释放时，任何一个等待锁的线程都有机会获得锁。
- synchronized的锁是非公平锁，ReentrantLock默认情况下也是非公平锁，但可以通过带布尔值的构造函数要求使用公平锁。
  - ReentrantLock 构造器的一个参数是boolean值，它允许您选择想要一个公平（fair）锁，还是一个不公平（unfair）锁。公平锁：使线程按照请求锁的顺序依次获得锁, 但是有成本;不公平锁：则允许讨价还价
  - 那么如何用代码设置公平锁呢？如下所示
  - ![image](/Users/mbpzy/images/16687054177950c6~tplv-t2oaga2asx-watermark.awebp)

##### 1.2.4 锁绑定多个条件

- ReentrantLock可以同时绑定多个Condition对象，只需多次调用newCondition方法即可。
- synchronized中，锁对象的wait()和notify()或notifyAll()方法可以实现一个隐含的条件。但如果要和多于一个的条件关联的时候，就不得不额外添加一个锁。

#### 1.3 什么是线程安全问题？如何理解

- 如果你的代码所在的进程中有多个线程在同时运行，而这些线程可能会同时运行这段代码。如果每次运行结果和单线程运行的结果是一样的，而且其他的变量的值也和预期的是一样的，就是线程安全的，或者说:一个类或者程序所提供的接口对于线程来说是原子操作或者多个线程之间的切换不会导致该接口的执行结果存在二义性,也就是说我们不用考虑同步的问题 。

#### 2.4 线程安全需要保证几个基本特性

- 1、原子性，简单说就是相关操作不会中途被其他线程干扰，一般通过同步机制实现。
- 2、可见性，是一个线程修改了某个共享变量，其状态能够立即被其他线程知晓，通常被解释为将线程本地状态反映到主内存上，volatile 就是负责保证可见性的。
- 3、有序性，是保证线程内串行语义，避免指令重排等。

### 2.Synchronize在编译时如何实现锁机制

- Synchronized进过编译，会在同步块的前后分别形成monitorenter和monitorexit这个两个字节码指令。在执行monitorenter指令时，首先要尝试获取对象锁。如果这个对象没被锁定，或者当前线程已经拥有了那个对象锁，把锁的计算器加1，相应的，在执行monitorexit指令时会将锁计算器就减1，当计算器为0时，锁就被释放了。如果获取对象锁失败，那当前线程就要阻塞，直到对象锁被另一个线程释放为止。

### 3.ReentrantLock使用方法

- ReentrantLock是java.util.concurrent包下提供的一套互斥锁，相比Synchronized，ReentrantLock类提供了一些高级功能，主要有以下3项：

  - 1.等待可中断，持有锁的线程长期不释放的时候，正在等待的线程可以选择放弃等待，这相当于Synchronized来说可以避免出现死锁的情况。
  - 2.公平锁，多个线程等待同一个锁时，必须按照申请锁的时间顺序获得锁，Synchronized锁非公平锁，ReentrantLock默认的构造函数是创建的非公平锁，可以通过参数true设为公平锁，但公平锁表现的性能不是很好。
  - 3.锁绑定多个条件，一个ReentrantLock对象可以同时绑定对个对象。

- 使用方法代码如下

  ```
  private ReentrantLock lock = new ReentrantLock();
  public void run() {
      lock.lock();
      try{
          for(int i=0;i<5;i++){
              System.out.println(Thread.currentThread().getName()+":"+i);
          }
      }finally{
          lock.unlock();
      }
  }
  复制代码
  ```

- 注意问题：为保证锁释放，每一个 lock() 动作，建议都立即对应一都立即对应一个 try-catch-finally

### 4.ReentrantLock锁机制测试案例分析

#### 4.1 代码案例分析

- 代码如下所示

  ```
  private void test2() {
      Runnable t1 = new MyThread();
      new Thread(t1,"t1").start();
      new Thread(t1,"t2").start();
  }
  
  class MyThread implements Runnable {
      private ReentrantLock lock = new ReentrantLock();
      public void run() {
          lock.lock();
          try{
              for(int i=0;i<5;i++){
                  System.out.println(Thread.currentThread().getName()+":"+i);
              }
          }finally{
              lock.unlock();
          }
      }
  }
  
  //打印值如下所示
  10-17 17:06:59.222 6531-6846/com.yc.cn.ycbaseadapter I/System.out: t1:0
  10-17 17:06:59.222 6531-6846/com.yc.cn.ycbaseadapter I/System.out: t1:1
  10-17 17:06:59.222 6531-6846/com.yc.cn.ycbaseadapter I/System.out: t1:2
  10-17 17:06:59.222 6531-6846/com.yc.cn.ycbaseadapter I/System.out: t1:3
  10-17 17:06:59.222 6531-6846/com.yc.cn.ycbaseadapter I/System.out: t1:4
  10-17 17:06:59.224 6531-6847/com.yc.cn.ycbaseadapter I/System.out: t2:0
  10-17 17:06:59.225 6531-6847/com.yc.cn.ycbaseadapter I/System.out: t2:1
  10-17 17:06:59.225 6531-6847/com.yc.cn.ycbaseadapter I/System.out: t2:2
  10-17 17:06:59.225 6531-6847/com.yc.cn.ycbaseadapter I/System.out: t2:3
  10-17 17:06:59.225 6531-6847/com.yc.cn.ycbaseadapter I/System.out: t2:4
  复制代码
  ```

#### 4.2 什么时候选择用ReentrantLock

- 适用场景：时间锁等候、可中断锁等候、无块结构锁、多个条件变量或者锁投票

- 在确实需要一些 synchronized所没有的特性的时候，比如时间锁等候、可中断锁等候、无块结构锁、多个条件变量或者锁投票。 ReentrantLock 还具有可伸缩性的好处，应当在高度争用的情况下使用它，但是请记住，大多数 synchronized 块几乎从来没有出现过争用，所以可以把高度争用放在一边。我建议用 synchronized 开发，直到确实证明 synchronized 不合适，而不要仅仅是假设如果使用 ReentrantLock “性能会更好”。请记住，这些是供高级用户使用的高级工具。（而且，真正的高级用户喜欢选择能够找到的最简单工具，直到他们认为简单的工具不适用为止。）。一如既往，首先要把事情做好，然后再考虑是不是有必要做得更快。

- 使用场景代码展示【摘自ThreadPoolExecutor类，这个类中很多地方用到了这个锁。自己可以查看】：

  ```
  /**
   * Rolls back the worker thread creation.
   * - removes worker from workers, if present
   * - decrements worker count
   * - rechecks for termination, in case the existence of this
   *   worker was holding up termination
   */
  private void addWorkerFailed(Worker w) {
      final ReentrantLock mainLock = this.mainLock;
      mainLock.lock();
      try {
          if (w != null)
              workers.remove(w);
          decrementWorkerCount();
          tryTerminate();
      } finally {
          mainLock.unlock();
      }
  }
  复制代码
  ```

#### 4.3 公平锁和非公平锁有何区别

- 公平性是指在竞争场景中，当公平性为真时，会倾向于将锁赋予等待时间最久的线程。公平性是减少线程“饥饿”（个别线程长期等待锁，但始终无法获取）情况发生的一个办法。

  - 1、公平锁能保证：老的线程排队使用锁，新线程仍然排队使用锁。
  - 2、非公平锁保证：老的线程排队使用锁；但是无法保证新线程抢占已经在排队的线程的锁。
  - 看下面代码案例所示：可以得出结论，公平锁指的是哪个线程先运行，那就可以先得到锁。非公平锁是不管线程是否是先运行，新的线程都有可能抢占已经在排队的线程的锁。

  ```
  private void test3() {
      Service service = new Service();
      ThreadClass tcArray[] = new ThreadClass[10];
      for(int i=0;i<10;i++){
          tcArray[i] = new ThreadClass(service);
          tcArray[i].start();
      }
  }
  
  public class Service {
      ReentrantLock lock = new ReentrantLock(true);
      Service() {
      }
  
      void getThreadName() {
          System.out.println(Thread.currentThread().getName() + " 已经被锁定");
      }
  }
  public class ThreadClass extends Thread{
      private Service service;
      ThreadClass(Service service) {
          this.service = service;
      }
      public void run(){
          System.out.println(Thread.currentThread().getName() + " 抢到了锁");
          service.lock.lock();
          service.getThreadName();
          service.lock.unlock();
      }
  }
  //当ReentrantLock设置true，也就是公平锁时
  10-17 19:32:22.422 6459-6523/com.yc.cn.ycbaseadapter I/System.out: Thread-5 抢到了锁
  10-17 19:32:22.422 6459-6523/com.yc.cn.ycbaseadapter I/System.out: Thread-5 已经被锁定
  10-17 19:32:22.424 6459-6524/com.yc.cn.ycbaseadapter I/System.out: Thread-6 抢到了锁
  10-17 19:32:22.424 6459-6524/com.yc.cn.ycbaseadapter I/System.out: Thread-6 已经被锁定
  10-17 19:32:22.427 6459-6525/com.yc.cn.ycbaseadapter I/System.out: Thread-7 抢到了锁
  10-17 19:32:22.427 6459-6526/com.yc.cn.ycbaseadapter I/System.out: Thread-8 抢到了锁
  10-17 19:32:22.427 6459-6525/com.yc.cn.ycbaseadapter I/System.out: Thread-7 已经被锁定
  10-17 19:32:22.427 6459-6526/com.yc.cn.ycbaseadapter I/System.out: Thread-8 已经被锁定
  10-17 19:32:22.427 6459-6527/com.yc.cn.ycbaseadapter I/System.out: Thread-9 抢到了锁
  10-17 19:32:22.427 6459-6527/com.yc.cn.ycbaseadapter I/System.out: Thread-9 已经被锁定
  10-17 19:32:22.428 6459-6528/com.yc.cn.ycbaseadapter I/System.out: Thread-10 抢到了锁
  10-17 19:32:22.428 6459-6528/com.yc.cn.ycbaseadapter I/System.out: Thread-10 已经被锁定
  10-17 19:32:22.429 6459-6529/com.yc.cn.ycbaseadapter I/System.out: Thread-11 抢到了锁
  10-17 19:32:22.429 6459-6529/com.yc.cn.ycbaseadapter I/System.out: Thread-11 已经被锁定
  10-17 19:32:22.430 6459-6530/com.yc.cn.ycbaseadapter I/System.out: Thread-12 抢到了锁
  10-17 19:32:22.430 6459-6530/com.yc.cn.ycbaseadapter I/System.out: Thread-12 已经被锁定
  10-17 19:32:22.431 6459-6532/com.yc.cn.ycbaseadapter I/System.out: Thread-14 抢到了锁
  10-17 19:32:22.431 6459-6532/com.yc.cn.ycbaseadapter I/System.out: Thread-14 已经被锁定
  10-17 19:32:22.432 6459-6531/com.yc.cn.ycbaseadapter I/System.out: Thread-13 抢到了锁
  10-17 19:32:22.433 6459-6531/com.yc.cn.ycbaseadapter I/System.out: Thread-13 已经被锁定
  
  
  //当ReentrantLock设置false，也就是非公平锁时
  10-17 19:34:58.102 7089-7183/com.yc.cn.ycbaseadapter I/System.out: Thread-5 抢到了锁
  10-17 19:34:58.102 7089-7184/com.yc.cn.ycbaseadapter I/System.out: Thread-6 抢到了锁
  10-17 19:34:58.103 7089-7183/com.yc.cn.ycbaseadapter I/System.out: Thread-5 已经被锁定
  10-17 19:34:58.103 7089-7185/com.yc.cn.ycbaseadapter I/System.out: Thread-7 抢到了锁
  10-17 19:34:58.103 7089-7185/com.yc.cn.ycbaseadapter I/System.out: Thread-7 已经被锁定
  10-17 19:34:58.103 7089-7184/com.yc.cn.ycbaseadapter I/System.out: Thread-6 已经被锁定
  10-17 19:34:58.104 7089-7186/com.yc.cn.ycbaseadapter I/System.out: Thread-8 抢到了锁
  10-17 19:34:58.105 7089-7186/com.yc.cn.ycbaseadapter I/System.out: Thread-8 已经被锁定
  10-17 19:34:58.108 7089-7187/com.yc.cn.ycbaseadapter I/System.out: Thread-9 抢到了锁
  10-17 19:34:58.108 7089-7187/com.yc.cn.ycbaseadapter I/System.out: Thread-9 已经被锁定
  10-17 19:34:58.111 7089-7188/com.yc.cn.ycbaseadapter I/System.out: Thread-10 抢到了锁
  10-17 19:34:58.112 7089-7188/com.yc.cn.ycbaseadapter I/System.out: Thread-10 已经被锁定
  10-17 19:34:58.112 7089-7189/com.yc.cn.ycbaseadapter I/System.out: Thread-11 抢到了锁
  10-17 19:34:58.113 7089-7189/com.yc.cn.ycbaseadapter I/System.out: Thread-11 已经被锁定
  10-17 19:34:58.113 7089-7193/com.yc.cn.ycbaseadapter I/System.out: Thread-14 抢到了锁
  10-17 19:34:58.113 7089-7193/com.yc.cn.ycbaseadapter I/System.out: Thread-14 已经被锁定
  10-17 19:34:58.115 7089-7190/com.yc.cn.ycbaseadapter I/System.out: Thread-12 抢到了锁
  10-17 19:34:58.115 7089-7190/com.yc.cn.ycbaseadapter I/System.out: Thread-12 已经被锁定
  10-17 19:34:58.116 7089-7191/com.yc.cn.ycbaseadapter I/System.out: Thread-13 抢到了锁
  10-17 19:34:58.116 7089-7191/com.yc.cn.ycbaseadapter I/System.out: Thread-13 已经被锁定
  复制代码
  ```

### 5.问答测试题

#### 5.1 ReentrantLock和synchronized使用分析

- ReentrantLock是Lock的实现类，是一个互斥的同步器，在多线程高竞争条件下，ReentrantLock比synchronized有更加优异的性能表现。
- 1 用法比较
  - Lock使用起来比较灵活，但是必须有释放锁的配合动作
  - Lock必须手动获取与释放锁，而synchronized不需要手动释放和开启锁
  - Lock只适用于代码块锁，而synchronized可用于修饰方法、代码块等
- 2 特性比较
  - ReentrantLock的优势体现在：
    - 具备尝试非阻塞地获取锁的特性：当前线程尝试获取锁，如果这一时刻锁没有被其他线程获取到，则成功获取并持有锁
    - 能被中断地获取锁的特性：与synchronized不同，获取到锁的线程能够响应中断，当获取到锁的线程被中断时，中断异常将会被抛出，同时锁会被释放
    - 超时获取锁的特性：在指定的时间范围内获取锁；如果截止时间到了仍然无法获取锁，则返回
- 3 注意事项
  - 在使用ReentrantLock类的时，一定要注意三点：
    - 在finally中释放锁，目的是保证在获取锁之后，最终能够被释放
    - 不要将获取锁的过程写在try块内，因为如果在获取锁时发生了异常，异常抛出的同时，也会导致锁无故被释放。
    - ReentrantLock提供了一个newCondition的方法，以便用户在同一锁的情况下可以根据不同的情况执行等待或唤醒的动作。

### 


作者：杨充
链接：https://juejin.cn/post/6844903695298068487
来源：稀土掘金
著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。