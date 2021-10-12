## 1.Redis常见问题

### 使用 Redis 有什么缺点

 **主要是四个问题：** 
- 缓存和数据库双写一致性问题
- 缓存雪崩问题
- 缓存击穿问题
- 缓存的并发竞争问题

### 单线程的 Redis 为什么这么快
- Redis 是单线程工作模型,纯内存操作
- 单线程操作，避免了频繁的上下文切换
- 采用了非阻塞 I/O 多路复用机制

### 什么是I/O多路复用机制？
打一个比方：小曲在 S 城开了一家快递店，负责同城快送服务。小曲因为资金限制，雇佣了一批快递员，然后小曲发现资金不够了，只够买一辆车送快递。


 **经营方式一** 
- 客户每送来一份快递，小曲就让一个快递员盯着，然后快递员开车去送快递。慢慢的小曲就发现了这种经营方式存在下述问题：几十个快递员基本上时间都花在了抢车上了，大部分快递员都处在闲置状态，谁抢到了车，谁就能去送快递。随着快递的增多，快递员也越来越多，小曲发现快递店里越来越挤，没办法雇佣新的快递员了。快递员之间的协调很花时间。

综合上述缺点，小曲痛定思痛，提出了下面的经营方式。

 **经营方式二** 
- 小曲只雇佣一个快递员。然后呢，客户送来的快递，小曲按送达地点标注好，然后依次放在一个地方。最后，那个快递员依次的去取快递，一次拿一个，然后开着车去送快递，送好了就回来拿下一个快递。上述两种经营方式对比，是不是明显觉得第二种，效率更高，更好呢？

 **在上述比喻中：** 
- 每个快递员→每个线程
- 每个快递→每个 Socket(I/O 流)
- 快递的送达地点→Socket 的不同状态
- 客户送快递请求→来自客户端的请求
- 小曲的经营方式→服务端运行的代码
- 一辆车→CPU 的核数

 **于是我们有如下结论：** 
- 经营方式一就是传统的并发模型，每个 I/O 流(快递)都有一个新的线程(快递员)管理。
- 经营方式二就是 I/O 多路复用。只有单个线程(一个快递员)，通过跟踪每个 I/O 流的状态(每个快递的送达地点)，来管理多个I/O 流。

下面类比到真实的 Redis 线程模型，如图所示：
![输入图片说明](https://images.gitee.com/uploads/images/2018/0730/140053_b7bf981c_1478371.png "屏幕截图.png")

简单来说，就是我们的 redis-client 在操作的时候，会产生具有不同事件类型的 Socket。

在服务端，有一段 I/O 多路复用程序，将其置入队列之中。然后，文件事件分派器，依次去队列中取，转发到不同的事件处理器中。

需要说明的是，这个 I/O 多路复用机制，Redis 还提供了 select、epoll、evport、kqueue 等多路复用函数库，大家可以自行去了解。

#### 几种 I/O 模型

为什么 Redis 中要使用 I/O 多路复用这种技术呢？

首先，Redis 是跑在单线程中的，所有的操作都是按照顺序线性执行的，但是由于读写操作等待用户输入或输出都是阻塞的，所以 I/O 操作在一般情况下往往不能直接返回，这会导致某一文件的 I/O 阻塞导致整个进程无法对其它客户提供服务，而 **I/O 多路复用**就是为了解决这个问题而出现的。

#### 阻塞IO

先来看一下传统的阻塞 I/O 模型到底是如何工作的：当使用 `read` 或者 `write` 对某一个**文件描述符（File Descriptor 以下简称 FD)**进行读写时，如果当前 FD 不可读或不可写，整个 Redis 服务就不会对其它的操作作出响应，导致整个服务不可用。

这也就是传统意义上的，也就是我们在编程中使用最多的阻塞模型：

![img](/Users/mbpzy/images/1-2752455-3999976.png)

在这种 IO 模型的场景下，我们是给每一个客户端连接创建一个线程去处理它。不管这个客户端建立了连接有没有在做事（发送读取数据之类），都要去维护这个连接，直到连接断开为止。创建过多的线程就会消耗过高的资源，以 Java BIO 为例

- BIO 是一个同步阻塞 IO
- Java 线程的实现取决于底层操作系统的实现在 linux 系统中，一个线程映射到一个轻量级进程（用户态中）然后去调用内核线程执行操作
- 对线程的调度，切换时刻状态的存储等等都要消耗很多 CPU 和缓存资源
- 同步：客户端请求服务端后，服务端开始处理假设处理1秒钟，这一秒钟就算客户端再发送很多请求过来，服务端也忙不过来，它必须等到之前的请求处理完毕后再去处理下一个请求，当然我们可以使用伪异步 IO 来实现，也就是实现一个线程池，客户端请求过来后就丢给线程池处理，那么就能够继续处理下一个请求了
- 阻塞：inputStream.read(data) 会通过 recvfrom 去接收数据，如果内核数据还没有准备好就会一直处于阻塞状态

由此可见阻塞 I/O 难以支持高并发的场景

```java
public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(9999);
        // 新建一个线程用于接收客户端连接
        // 伪异步 IO
        new Thread(() -> {
            while (true) {
                System.out.println("开始阻塞, 等待客户端连接");
                try {
                    Socket socket = serverSocket.accept();
                    // 每一个新来的连接给其创建一个线程去处理
                    new Thread(() -> {
                        byte[] data = new byte[1024];
                        int len = 0;
                        System.out.println("客户端连接成功，阻塞等待客户端传入数据");
                        try {
                            InputStream inputStream = socket.getInputStream();
                            // 阻塞式获取数据直到客户端断开连接
                            while ((len = inputStream.read(data)) != -1) {
                                // 或取到数据
                                System.out.println(new String(data, 0, len));
                                // 处理数据
                            }
                        } catch (IOException e) {
                            e.printStackTrace();
                        }
                    }).start();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }

```

如果接受到了一个客户端连接而不采用对应的一个线程去处理的话，首先 serverSocket.accept(); 无法去获取其它连接，其次 inputStream.read() 可以看到获取到数据后需要处理完成后才能处理接收下一份数据，正因如此在阻塞 I/O 模型的场景下我们需要为每一个客户端连接创建一个线程去处理

阻塞模型虽然开发中非常常见也非常易于理解，但是由于它会影响其他 FD 对应的服务，所以在需要处理多个客户端任务的时候，往往都不会使用阻塞模型。

#### 非阻塞IO

![img](/Users/mbpzy/images/3-2752454-3999976.png)

可以看到是通过服务端应用程序不断的轮询内核数据是否准备好，如果数据没有准备好的话，内核就返回一个 BWOULDBLOCK 错误，那么应用程序就继续轮询直到数据准备好了为止，在 Java 中的 NIO(非阻塞I/O, New I/O) 底层是通过多路复用 I/O 模型实现的。而现实的场景也是诸如 netty，redis，nginx，nodejs 都是采用的多路复用 I/O 模型，因为在非阻塞 I/O 这种场景下需要我们不断的去轮询，也是会消耗大量的 CPU 资源的，一般很少采用这种方式。我们这里手写一段伪代码来看下

```java
Socket socket = serverSocket.accept();
    // 不断轮询内核，哪个 socket 的数据是否准备好了
    while (true) {
        data = socket.read();
        if (data != BWOULDBLOCK) {
            // 表示获取数据成功
            doSomething();
        }
    }
```

#### 多路复用IO

阻塞式的 I/O 模型并不能满足这里的需求，我们需要一种效率更高的 I/O 模型来支撑 Redis 的多个客户（redis-cli），这里涉及的就是 I/O 多路复用模型了

Java 中的 NIO 就是采用的多路复用机制，他在不同的操作系统有不同的实现，在 windows 上采用的是 select ,在 unix/linux 上是 epoll。而 poll 模型是对 select 稍许升级大致相同。

最先出现的是 select 。后由于 select 的一些痛点比如它在 32 位系统下，单进程支持最多打开 1024 个文件描述符（linux 对 IO 等操作都是通过对应的文件描述符实现的 socket 对应的是 socket 文件描述符），poll 对其进行了一些优化，比如突破了 1024 这个限制，他能打开的文件描述符不受限制（但还是要取决于系统资源），而上述 2 中模型都有一个很大的性能问题导致产生出了 epoll。后面会详细分析

![img](/Users/mbpzy/images/2-2752455-3999977.png)

在 I/O 多路复用模型中，最重要的函数调用就是 `select`，该方法的能够同时监控多个文件描述符的可读可写情况，当其中的某些文件描述符可读或者可写时，`select` 方法就会返回可读以及可写的文件描述符个数。

> 关于 `select` 的具体使用方法，在网络上资料很多，这里就不过多展开介绍了；
>
> 与此同时也有其它的 I/O 多路复用函数 `epoll/kqueue/evport`，它们相比 `select` 性能更优秀，同时也能支撑更多的服务。

#### Reactor 设计模式

Redis 服务采用 Reactor 的方式来实现文件事件处理器（每一个网络连接其实都对应一个文件描述符）

Redis基于Reactor模式开发了网络事件处理器，这个处理器被称为文件事件处理器。它的组成结构为4部分：多个套接字、IO多路复用程序、文件事件分派器、事件处理器。因为文件事件分派器队列的消费是单线程的，所以Redis才叫单线程模型。

![img](/Users/mbpzy/images/4-2752455-3999976.png)

![img](/Users/mbpzy/images/6-2752455-3999977.png)

![img](/Users/mbpzy/images/7-2752456-3999977.png)

![img](/Users/mbpzy/images/9-2752455-3999977.png)

#### 消息处理流程

- ==文件事件分派器使用I/O多路复用(multiplexing)程序来同时监听多个套接字，也有叫FD(file Description文件描述符)，(将这些套接字放入同一个队列之中)，并根据套接字目前执行的任务来为套接字关联不同的文件事件处理器。==
- ==当被监听的套接字准备好执行连接应答(accept)、读取(read)、写入(write)、关闭(close)等操作时，与操作相对应的文件事件就会产生，这时文件事件分派器就会回调套接字之前关联好的事件处理器来处理这些事件。==

==**尽管多个文件事件可能会并发地出现，但I/O多路复用程序总是会将所有产生事件的套接字都推到一个队列里面，然后通过这个队列，以有序（sequentially）、同步（synchronously）、每次一个套接字的方式向文件事件分派器传送套接字：当上一个套接字产生的事件被处理完毕之后（该套接字为事件所关联的事件处理器执行完毕）， I/O多路复用程序才会继续向文件事件分派器传送下一个套接字**。==

==虽然**整个文件事件处理器是在单线程上运行的**，但是通过 I/O 多路复用模块的引入，实现了同时对多个 FD(文件描述符) 读写的监控，提高了网络通信模型的性能，同时也可以保证整个 Redis 服务实现的简单==

#### 文件事件处理器

Redis基于Reactor模式开发了网络事件处理器，这个处理器叫做文件事件处理器 file event handler。这个文件事件处理器，它是单线程的，所以 Redis 才叫做单线程的模型，它采用IO多路复用机制来同时监听多个Socket，根据Socket上的事件类型来选择对应的事件处理器来处理这个事件。

如果被监听的 Socket 准备好执行accept、read、write、close等操作的时候，跟操作对应的文件事件就会产生，这个时候文件事件处理器就会调用之前关联好的事件处理器来处理这个事件。

文件事件处理器是单线程模式运行的，但是通过IO多路复用机制监听多个Socket，可以实现高性能的网络通信模型，又可以跟内部其他单线程的模块进行对接，保证了 Redis 内部的线程模型的简单性。

文件事件处理器的结构包含4个部分：**多个Socket**、**IO多路复用程序**、**文件事件分派器**以及**事件处理器**（命令请求处理器、命令回复处理器、连接应答处理器等）。

多个 Socket 可能并发的产生不同的操作，每个操作对应不同的文件事件，但是IO多路复用程序会监听多个 Socket，会将 Socket 放入一个队列中排队，**每次从队列中取出一个 Socket 给事件分派器**，**事件分派器把 Socket 给对应的事件处理器**。

然后一个 Socket 的事件处理完之后，IO多路复用程序才会将队列中的下一个 Socket 给事件分派器。文件事件分派器会根据每个 Socket 当前产生的事件，来选择对应的事件处理器来处理。

#### 文件事件

当 Socket 变得可读时（比如客户端对redis执行write操作，或者close操作），或者有新的可以应答的 Socket 出现时（客户端对redis执行connect操作），Socket就会产生一个AE_READABLE事件。

当 Socket 变得可写的时候（客户端对redis执行read操作），Socket 会产生一个AE_WRITABLE事件。

IO 多路复用程序可以同时监听 AE_REABLE 和 AE_WRITABLE 两种事件，如果一个Socket同时产生了这两种事件，那么文件事件分派器**优先处理 AE_READABLE 事件，然后才是 AE_WRITABLE 事件**。

#### 文件事件处理器

如果是客户端要连接redis，那么会为 Socket 关联连接应答处理器。

如果是客户端要写数据到redis，那么会为 Socket 关联命令请求处理器。

如果是客户端要从redis读数据，那么会为 Socket 关联命令回复处理器。

#### 客户端与redis通信的一次流程

在 Redis 启动初始化的时候，Redis 会将连接应答处理器跟 AE_READABLE 事件关联起来，接着如果一个客户端跟Redis发起连接，此时会产生一个 AE_READABLE 事件，然后由连接应答处理器来处理跟客户端建立连接，创建客户端对应的 Socket，同时将这个 Socket 的 AE_READABLE 事件跟命令请求处理器关联起来。

当客户端向Redis发起请求的时候（不管是读请求还是写请求，都一样），首先就会在 Socket 产生一个 AE_READABLE 事件，然后由对应的命令请求处理器来处理。这个命令请求处理器就会从Socket中读取请求相关数据，然后进行执行和处理。

接着Redis这边准备好了给客户端的响应数据之后，就会将Socket的AE_WRITABLE事件跟命令回复处理器关联起来，当客户端这边准备好读取响应数据时，就会在 Socket 上产生一个 AE_WRITABLE 事件，会由对应的命令回复处理器来处理，就是将准备好的响应数据写入 Socket，供客户端来读取。

命令回复处理器写完之后，就会删除这个 Socket 的 AE_WRITABLE 事件和命令回复处理器的关联关系。

#### 多路复用模块

I/O 多路复用模块封装了底层的 `select`、`epoll`、`avport` 以及 `kqueue` 这些 I/O 多路复用函数，为上层提供了相同的接口。

![img](/Users/mbpzy/images/5-2752455-3999977.png)

整个 I/O 多路复用模块抹平了不同平台上 I/O 多路复用函数的差异性，提供了相同的接口

#### 子模块的选择

因为 Redis 需要在多个平台上运行，同时为了最大化执行的效率与性能，所以会根据编译平台的不同选择不同的 I/O 多路复用函数作为子模块，提供给上层统一的接口；在 Redis 中，我们通过宏定义的使用，合理的选择不同的子模块：

```
ifdef HAVE_EVPORTinclude "ae_evport.c"else    ifdef HAVE_EPOLL    include "ae_epoll.c"    else        ifdef HAVE_KQUEUE        include "ae_kqueue.c"        elsec        include "ae_select.c"        endif    endif
```

因为 `select` 函数是作为 POSIX 标准中的系统调用，在不同版本的操作系统上都会实现，所以将其作为保底方案：

![img](/Users/mbpzy/images/8-2752456-3999977.png)

Redis 会优先选择时间复杂度为 $O(1)$ 的 I/O 多路复用函数作为底层实现，包括 Solaries 10 中的 `evport`、Linux 中的 `epoll` 和 macOS/FreeBSD 中的 `kqueue`，上述的这些函数都使用了内核内部的结构，并且能够服务几十万的文件描述符。

但是如果当前编译环境没有上述函数，就会选择 `select` 作为备选方案，由于其在使用时会扫描全部监听的描述符，所以其时间复杂度较差 $O(n)$，并且只能同时服务 1024 个文件描述符，所以一般并不会以 `select` 作为第一方案使用。

#### 动图理解

通常的一次的请求结果如下图所示：

![img](/Users/mbpzy/images/10-3999977.gif)

但是，服务器往往不会只处理一次请求，往往是多个请求，这一个请求，这时候每来一个请求，就会生成一个进程或线程。

![img](/Users/mbpzy/images/11-2752455-3999977.png)

在这些请求线程或者进程中，大部分都处于等待阶段，只有少部分是接收数据。这样一来，非常耗费资源，而且这些线程或者进程的管理，也是个事儿。

![img](/Users/mbpzy/images/12-2752455-3999977.png)

于是，有人想到一个办法：我们只用一个线程或者进程来和系统内核打交道，并想办法把每个应用的I/O流状态记录下来，一有响应变及时返回给相应的应用。

![img](/Users/mbpzy/images/13-2752455-3999977.png)

或者下图：

![img](/Users/mbpzy/images/14-2752456-3999977.png)

#### select、poll、epoll

select, poll, epoll 都是I/O多路复用的具体实现，他们出现是有先后顺序的。

select是第一个实现 (1983 左右在BSD里面实现的)。

select 被实现后，发现诸多问题，然后1997年实现了poll，对select进行了改进，select和poll是很类似的。

再后来，2002做出重大改进实现了epoll。

epoll和 select/poll 有着很大的不同：

例如：select/poll的处理流程如下：

![img](/Users/mbpzy/images/15-3999977.gif)

而epoll的处理流程如下：

![img](/Users/mbpzy/images/16-3999977.gif)

这样，就无需遍历成千上万个消息列表了，直接可以定位哪个socket有数据。

那么，这是如何实现的呢？

早期的时候 epoll的实现是一个哈希表，但是后来由于占用空间比较大，改为了红黑树和链表

![img](/Users/mbpzy/images/17-3999977.jpg)

其中链表中全部为活跃的链接，红黑树中放的是所有事件。两部分各司其职。 这样一来，当收到内核的数据时，只需遍历链表中的数据就行了，而注册read事件或者write事件的时候，向红黑树中记录。

结果导致：

- 创建\修改\删除消息效率非常高：O(logN)。
- 获取活跃链接也非常快，因为在一个时间内，大部分是不活跃的链接，活跃的链接是少数，只需要遍历少数活跃的链接就好了

select：将之前传入的fd_set拷贝传出到用户态并返回就绪的文件描述符总数。用户态并不知道是哪些文件描述符处于就绪态，需要遍历来判断。

epoll：epoll_wait只用观察就绪链表中有无数据即可，最后将链表的数据返回给数组并返回就绪的数量。内核将就绪的文件描述符放在传入的数组中，所以只用遍历依次处理即可。这里返回的文件描述符是通过mmap让内核和用户空间共享同一块内存实现传递的，减少了不必要的拷贝。

### 为啥Redis单线程模型也能效率这么高？

**1）纯内存操作**

Redis 将所有数据放在内存中，内存的响应时长大约为 100 纳秒，这是 redis 的 QPS 过万的重要基础。

**2）核心是基于非阻塞的IO多路复用机制**

有了非阻塞 IO 意味着线程在读写 IO 时可以不必再阻塞了，读写可以瞬间完成然后线程可以继续干别的事了。

redis 需要处理多个 IO 请求，同时把每个请求的结果返回给客户端。由于 redis 是单线程模型，同一时间只能处理一个 IO 事件，于是 redis 需要在合适的时间暂停对某个 IO 事件的处理，转而去处理另一个 IO 事件，这就需要用到IO多路复用技术了， 就好比一个管理者，能够管理个socket的IO事件，当选择了哪个socket，就处理哪个socket上的 IO 事件，其他 IO 事件就暂停处理了。

**3）单线程反而避免了多线程的频繁上下文切换带来的性能问题。**（百度多线程上下文切换）

第一，单线程可以简化数据结构和算法的实现。并发数据结构实现不但困难而且开发测试比较麻

第二，单线程避免了线程切换和竞态产生的消耗，对于服务端开发来说，锁和线程切换通常是性能杀手。

单线程的问题：对于每个命令的执行时间是有要求的。如果某个命令执行过长，会造成其他命令的阻塞，所以 redis 适用于那些需要快速执行的场景。


### Redis 的数据类型，以及每种数据类型的使用场景
1. String: 最常规的 set/get 操作，Value 可以是 String 也可以是数字。一般做一些复杂的计数功能的缓存。
1. Hash:这里 Value 存放的是结构化的对象，比较方便的就是操作其中的某个字段。做单点登录的时候，就是用这种数据结构存储用户信息，以 CookieId 作为 Key，设置 30 分钟为缓存过期时间，能很好的模拟出类似 Session 的效果。
1. List:使用 List 的数据结构，可以做简单的消息队列的功能。另外还有一个就是，可以利用 lrange 命令，做基于 Redis 的分页功能，性能极佳，用户体验好。
1. Set:因为 Set 堆放的是一堆不重复值的集合。所以可以做全局去重的功能。
1. Sorted Set:Sorted Set多了一个权重参数 Score，集合中的元素能够按 Score 进行排列。可以做排行榜应用，取 TOP N 操作。Sorted Set 可以用来做延时任务。最后一个应用就是可以做范围查找。

### Redis有哪些数据结构？

- 字符串String、字典Hash、列表List、集合Set、有序集合SortedSet。
- 如果你是Redis中高级用户，还需要加上下面几种数据结构HyperLogLog、Geo、Pub/Sub。
- 如果你说还玩过Redis Module，像BloomFilter，RedisSearch，Redis-ML，面试官得眼睛就开始发亮了。

### 使用过Redis分布式锁么，它是什么回事？

先拿setnx来争抢锁，抢到之后，再用expire给锁加一个过期时间防止锁忘记了释放

### 如果在setnx之后执行expire之前进程意外crash或者要重启维护了，那会怎么样？

- 按照逻辑来说这个锁就永远得不到释放了
- 我记得set指令有非常复杂的参数，这个应该是可以同时把setnx和expire合成一条指令来用的

### 假如Redis里面有1亿个key，其中有10w个key是以某个固定的已知的前缀开头的，如果将它们全部找出来？

使用keys指令可以扫出指定模式的key列表。

### 如果这个redis正在给线上的业务提供服务，那使用keys指令会有什么问题？

- 这个时候你要回答redis关键的一个特性：redis的单线程的。keys指令会导致线程阻塞一段时间，线上服务会停顿，直到指令执行完毕，服务才能恢复。这个时候可以使用scan指令，scan指令可以无阻塞的提取出指定模式的key列表，但是会有一定的重复概率，在客户端做一次去重就可以了，但是整体所花费的时间会比直接用keys指令长。

### 使用过Redis做异步队列么，你是怎么用的？

一般使用list结构作为队列，rpush生产消息，lpop消费消息。当lpop没有消息的时候，要适当sleep一会再重试。

### 可不可以不用sleep呢？

list还有个指令叫blpop，在没有消息的时候，它会阻塞住直到消息到来。

### 能不能生产一次消费多次呢？

使用pub/sub主题订阅者模式，可以实现1:N的消息队列。

### pub/sub有什么缺点？

在消费者下线的情况下，生产的消息会丢失，得使用专业的消息队列如rabbitmq,kafka等。

### redis如何实现延时队列？

使用sortedset，拿时间戳作为score，消息内容作为key调用zadd来生产消息，消费者用zrangebyscore指令获取N秒之前的数据轮询进行处理。

### 如果有大量的key需要设置同一时间过期，一般需要注意什么？

- 如果大量的key过期时间设置的过于集中，到过期的那个时间点，redis可能会出现短暂的卡顿现象。一般需要在时间上加一个随机值，使得过期时间分散一些。

### Redis如何做持久化的？

- bgsave做镜像全量持久化，aof做增量持久化。因为bgsave会耗费较长时间，不够实时，在停机的时候会导致大量丢失数据，所以需要aof来配合使用。在redis实例重启时，会使用bgsave持久化文件重新构建内存，再使用aof重放近期的操作指令来实现完整恢复重启之前的状态。

### 如果突然机器掉电会怎样？

- 取决于aof日志sync属性的配置，如果不要求性能，在每条写指令时都sync一下磁盘，就不会丢失数据。但是在高性能的要求下每次都sync是不现实的，一般都使用定时sync，比如1s1次，这个时候最多就会丢失1s的数据。

### bgsave的原理是什么？

- fork和cow。fork是指redis通过创建子进程来进行bgsave操作，cow指的是copy on write，子进程创建后，父子进程共享数据段，父进程继续提供读写服务，写脏的页面数据会逐渐和子进程分离开来。

### Pipeline有什么好处，为什么要用pipeline？

- 可以将多次IO往返的时间缩减为一次，前提是pipeline执行的指令之间没有因果相关性。使用redis-benchmark进行压测的时候可以发现影响redis的QPS峰值的一个重要因素是pipeline批次指令的数目。

### Redis的同步机制了解么？

- Redis可以使用主从同步，从从同步。第一次同步时，主节点做一次bgsave，并同时将后续修改操作记录到内存buffer，待完成后将rdb文件全量同步到复制节点，复制节点接受完成后将rdb镜像加载到内存。加载完成后，再通知主节点将期间修改的操作记录同步到复制节点进行重放就完成了同步过程。

### 是否使用过Redis集群，集群的原理是什么？

- Redis Sentinal着眼于高可用，在master宕机时会自动将slave提升为master，继续提供服务。
- Redis Cluster着眼于扩展性，在单个redis内存不足时，使用Cluster进行分片存储。

### 使用Redis有哪些好处？

- (1) 速度快，因为数据存在内存中，类似于HashMap，HashMap的优势就是查找和操作的时间复杂度都是O(1)
- (2) 支持丰富数据类型，支持string，list，set，sorted set，hash
- (3) 支持事务，操作都是原子性，所谓的原子性就是对数据的更改要么全部执行，要么全部不执行
- (4) 丰富的特性：可用于缓存，消息，按key设置过期时间，过期后将会自动删除

### redis相比memcached有哪些优势？

- memcached所有的值均是简单的字符串，redis作为其替代者，支持更为丰富的数据类型
- redis的速度比memcached快很多
- redis可以持久化其数据

### redis常见性能问题和解决方案：

- Master最好不要做任何持久化工作，如RDB内存快照和AOF日志文件。
- 写内存快照时，save命令调度rdbSave函数，会阻塞主线程的工作；
- AOF在重写的时候会占大量的CPU和内存资源。如果不重写AOF文件，这个持久化方式对性能的影响是最小的，但是AOF文件会不断增大，AOF文件过大会影响Master重启的恢复速度。
- 如果数据比较重要，某个Slave开启AOF备份数据，策略设置为每秒同步一次
- 为了主从复制的速度和连接的稳定性，Master和Slave最好在同一个局域网内
- 尽量避免在压力很大的主库上增加从库
- 主从复制不要用图状结构，用单向链表结构更为稳定，即：Master <- Slave1 <- Slave2 <- Slave3...这样的结构方便解决单点故障问题，实现Slave对Master的替换。如果Master挂了，可以立刻启用Slave1做Master，其他不变。

### MySQL里有2000w数据，redis中只存20w的数据，如何保证redis中的数据都是热点数据？

redis 内存数据集大小上升到一定大小的时候，就会施行数据淘汰策略。
redis 提供 6种数据淘汰策略：

    voltile-lru：从已设置过期时间的数据集（server.db[i].expires）中挑选最近最少使用的数据淘汰
    
    volatile-ttl：从已设置过期时间的数据集（server.db[i].expires）中挑选将要过期的数据淘汰
    
    volatile-random：从已设置过期时间的数据集（server.db[i].expires）中任意选择数据淘汰
    
    allkeys-lru：从数据集（server.db[i].dict）中挑选最近最少使用的数据淘汰
    
    allkeys-random：从数据集（server.db[i].dict）中任意选择数据淘汰
    no-enviction（驱逐）：禁止驱逐数据

由maxmemory-policy 参数设置淘汰策略：

    CONFIG SET maxmemory-policy volatile-lru      #淘汰有过时期的最近最好使用数据

  ### Redis过期策略

  * redis 会将每个设置了过期时间的 key 放入到一个独立的字典中,每秒进行十次过期扫描，过期扫描不会遍历过期字典中所有的 key，而是采用了一种简单的贪心策略.从过期字典中随机 20 个 key;删除这 20 个 key 中已经过期的 key;如果过期的 key 比率超过 1/4，那就重复步骤 1;
  * 同时，为了保证过期扫描不会出现循环过度，导致线程卡死现象，算法还增加了扫描时间的上限，默认不会超过 25ms。

  ### 从库的过期策略

  * 从库不会进行过期扫描，从库对过期的处理是被动的。主库在 key 到期时，会在 AOF 文件里增加一条 del 指令，同步到所有的从库，从库通过执行这条 del 指令 来删除过期的 key
  * 因为指令同步是异步进行的，所以主库过期的 key 的 del 指令没有及时同步到从库的话，会出现主从数据的不一致，主库没有的数据在从库里还存在

### Redis 的过期策略以及内存淘汰机制
Redis 采用的是定期删除+惰性删除策略。

 **为什么不用定时删除策略** 
- 定时删除，用一个定时器来负责监视 Key，过期则自动删除。虽然内存及时释放，但是十分消耗 CPU 资源。
- 在大并发请求下，CPU 要将时间应用在处理请求，而不是删除 Key，因此没有采用这一策略。

 **定期删除+惰性删除是如何工作** 
- 定期删除，Redis 默认每个 100ms 检查，是否有过期的 Key，有过期 Key 则删除。
- 需要说明的是，Redis 不是每个 100ms 将所有的 Key 检查一次，而是随机抽取进行检查(如果每隔 100ms，全部 Key 进行检查，Redis 岂不是卡死)。
- 因此，如果只采用定期删除策略，会导致很多 Key 到时间没有删除。于是，惰性删除派上用场。
- 也就是说在你获取某个 Key 的时候，Redis 会检查一下，这个 Key 如果设置了过期时间，那么是否过期了？如果过期了此时就会删除。

 **采用定期删除+惰性删除就没其他问题了么?** 
- 不是的，如果定期删除没删除 Key。然后你也没即时去请求 Key，也就是说惰性删除也没生效。这样，Redis的内存会越来越高。那么就应该采用内存淘汰机制。在 redis.conf 中有一行配置：

  ```bash
  maxmemory-policy volatile-lru
  ```

- 该配置就是配内存淘汰策略的

  1. noeviction：内存不足以容纳新写入数据时，新写入操作会报错。应该没人用吧。
  1. allkeys-lru：内存不足以容纳新写入数据时，在键空间中，移除最近最少使用的 Key。推荐使用，目前项目在用这种。
  1. allkeys-random：内存不足以容纳新写入数据时，在键空间中，随机移除某个 Key。应该也没人用吧，你不删最少使用 Key，去随机删。
  1. volatile-lru：内存不足以容纳新写入数据时，在设置了过期时间的键空间中，移除最近最少使用的 Key。这种情况一般是把 Redis 既当缓存，又做持久化存储的时候才用。不推荐。
  1. volatile-random：内存不足以容纳新写入数据时，在设置了过期时间的键空间中，随机移除某个 Key。依然不推荐。
  1. volatile-ttl：内存不足以容纳新写入数据时，在设置了过期时间的键空间中，有更早过期时间的 Key 优先移除。不推荐。

PS：如果没有设置 expire 的 Key，不满足先决条件(prerequisites)；那么 volatile-lru，volatile-random 和 volatile-ttl 策略的行为，和 noeviction(不删除) 基本上一致。


### Redis 和数据库双写一致性问题
一致性问题是分布式常见问题，还可以再分为最终一致性和强一致性。数据库和缓存双写，就必然会存在不一致的问题。

如果对数据有强一致性要求，不能放缓存。我们所做的一切，只能保证最终一致性。另外，我们所做的方案从根本上来说，只能说降低不一致发生的概率，无法完全避免。因此，有强一致性要求的数据，不能放缓存。

首先，采取正确更新策略，先更新数据库，再删缓存。其次，因为可能存在删除缓存失败的问题，提供一个补偿措施即可，例如利用消息队列。

看到很多小伙伴简历上写了“**熟练使用缓存**”，但是被我问到“**缓存常用的3种读写策略**”的时候却一脸懵逼。

在我看来，造成这个问题的原因是我们在学习 Redis 的时候，可能只是简单了写一些 Demo，并没有去关注缓存的读写策略，或者说压根不知道这回事。

但是，搞懂3种常见的缓存读写策略对于实际工作中使用缓存以及面试中被问到缓存都是非常有帮助的！

下面我会简单介绍一下自己对于这 3 种缓存读写策略的理解。 

另外，**这3 种缓存读写策略各有优劣，不存在最佳，需要我们根据具体的业务场景选择更适合的。**

*个人能力有限。如果文章有任何需要补充/完善/修改的地方，欢迎在评论区指出，共同进步！——爱你们的 Guide 哥*

### Cache Aside Pattern（旁路缓存模式）

**Cache Aside Pattern 是我们平时使用比较多的一个缓存读写模式，比较适合读请求比较多的场景。**

Cache Aside Pattern 中服务端需要同时维系 DB 和 cache，并且是以 DB 的结果为准。

下面我们来看一下这个策略模式下的缓存读写步骤。

**写** ：

- 先更新 DB
- 然后直接删除 cache 。

简单画了一张图帮助大家理解写的步骤。

![](/Users/mbpzy/images/5687fe759a1dac9ed9554d27e3a23b6d-4001117.png)

**读** :

- 从 cache 中读取数据，读取到就直接返回
- cache中读取不到的话，就从 DB 中读取数据返回
- 再把数据放到 cache 中。

简单画了一张图帮助大家理解读的步骤。

![](/Users/mbpzy/images/a8c18b5f5b1aed03234bcbbd8c173a87-4001117.png)


你仅仅了解了上面这些内容的话是远远不够的，我们还要搞懂其中的原理。

比如说面试官很可能会追问：“**在写数据的过程中，可以先删除 cache ，后更新 DB 么？**”

**答案：** 那肯定是不行的！因为这样可能会造成**数据库（DB）和缓存（Cache）数据不一致**的问题。为什么呢？比如说请求1 先写数据A，请求2随后读数据A的话就很有可能产生数据不一致性的问题。这个过程可以简单描述为：

> 请求1先把cache中的A数据删除 -> 请求2从DB中读取数据->请求1再把DB中的A数据更新。

当你这样回答之后，面试官可能会紧接着就追问：“**在写数据的过程中，先更新DB，后删除cache就没有问题了么？**”

**答案：** 理论上来说还是可能会出现数据不一致性的问题，不过概率非常小，因为缓存的写入速度是比数据库的写入速度快很多！

比如请求1先读数据 A，请求2随后写数据A，并且数据A不在缓存中的话也有可能产生数据不一致性的问题。这个过程可以简单描述为：

> 请求1从DB读数据A->请求2写更新数据 A 到数据库并把删除cache中的A数据->请求1将数据A写入cache。

现在我们再来分析一下 **Cache Aside Pattern 的缺陷**。

**缺陷1：首次请求数据一定不在 cache 的问题** 

解决办法：可以将热点数据可以提前放入cache 中。

**缺陷2：写操作比较频繁的话导致cache中的数据会被频繁被删除，这样会影响缓存命中率 。**

解决办法：

- 数据库和缓存数据强一致场景 ：更新DB的时候同样更新cache，不过我们需要加一个锁/分布式锁来保证更新cache的时候不存在线程安全问题。
- 可以短暂地允许数据库和缓存数据不一致的场景 ：更新DB的时候同样更新cache，但是给缓存加一个比较短的过期时间，这样的话就可以保证即使数据不一致的话影响也比较小。

### Read/Write Through Pattern（读写穿透）

Read/Write Through Pattern 中服务端把 cache 视为主要数据存储，从中读取数据并将数据写入其中。cache 服务负责将此数据读取和写入 DB，从而减轻了应用程序的职责。

这种缓存读写策略小伙伴们应该也发现了在平时在开发过程中非常少见。抛去性能方面的影响，大概率是因为我们经常使用的分布式缓存 Redis 并没有提供 cache 将数据写入DB的功能。

**写（Write Through）：**

- 先查 cache，cache 中不存在，直接更新 DB。
- cache 中存在，则先更新 cache，然后 cache 服务自己更新 DB（**同步更新 cache 和 DB**）。

简单画了一张图帮助大家理解写的步骤。

![](/Users/mbpzy/images/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3FxXzM0MzM3Mjcy,size_16,color_FFFFFF,t_70-4001117.png)

**读(Read Through)：** 

- 从 cache 中读取数据，读取到就直接返回 。
- 读取不到的话，先从 DB 加载，写入到 cache 后返回响应。

简单画了一张图帮助大家理解读的步骤。

![](/Users/mbpzy/images/9ada757c78614934aca11306f334638d-4001117.png)

Read-Through Pattern 实际只是在 Cache-Aside Pattern 之上进行了封装。在 Cache-Aside Pattern 下，发生读请求的时候，如果 cache 中不存在对应的数据，是由客户端自己负责把数据写入 cache，而 Read Through Pattern 则是 cache 服务自己来写入缓存的，这对客户端是透明的。

和 Cache Aside Pattern 一样， Read-Through Pattern 也有首次请求数据一定不再 cache 的问题，对于热点数据可以提前放入缓存中。

### Write Behind Pattern（异步缓存写入）

Write Behind Pattern 和 Read/Write Through Pattern 很相似，两者都是由 cache 服务来负责 cache 和 DB 的读写。

但是，两个又有很大的不同：**Read/Write Through 是同步更新 cache 和 DB，而 Write Behind Caching 则是只更新缓存，不直接更新 DB，而是改为异步批量的方式来更新 DB。**

很明显，这种方式对数据一致性带来了更大的挑战，比如cache数据可能还没异步更新DB的话，cache服务可能就就挂掉了。

这种策略在我们平时开发过程中也非常非常少见，但是不代表它的应用场景少，比如消息队列中消息的异步写入磁盘、MySQL 的 InnoDB Buffer Pool 机制都用到了这种策略。

Write Behind Pattern 下 DB 的写性能非常高，非常适合一些数据经常变化又对数据一致性要求没那么高的场景，比如浏览量、点赞量。

### 如何应对缓存穿透和缓存雪崩问题

 **缓存穿透**
-  即黑客故意去请求缓存中不存在的数据，导致所有的请求都怼到数据库上，从而数据库连接异常。

 **缓存穿透解决方案：** 
- 利用互斥锁，缓存失效的时候，先去获得锁，得到锁了，再去请求数据库。没得到锁，则休眠一段时间重试。
- 采用异步更新策略，无论 Key 是否取到值，都直接返回。Value 值中维护一个缓存失效时间，缓存如果过期，异步起一个线程去读数据库，更新缓存。需要做缓存预热(项目启动前，先加载缓存)操作。
- 提供一个能迅速判断请求是否有效的拦截机制，比如，利用布隆过滤器，内部维护一系列合法有效的 Key。迅速判断出，请求所携带的 Key 是否合法有效。如果不合法，则直接返回。

 **缓存雪崩** 
- 即缓存同一时间大面积的失效，这个时候又来了一波请求，结果请求都怼到数据库上，从而导致数据库连接异常

 **缓存雪崩解决方案：** 
- 给缓存的失效时间，加上一个随机值，避免集体失效。
- 使用互斥锁，但是该方案吞吐量明显下降了。
- 双缓存。我们有两个缓存，缓存 A 和缓存 B。缓存 A 的失效时间为 20 分钟，缓存 B 不设失效时间。自己做缓存预热操作。然后细分以下几个小点：从缓存 A 读数据库，有则直接返回；A 没有数据，直接从 B 读数据，直接返回，并且异步启动一个更新线程，更新线程同时更新缓存 A 和缓存 B。

### 如何解决 Redis 的并发竞争 Key 问题
- 这个问题大致就是，同时有多个子系统去 Set 一个 Key。这个时候大家思考过要注意什么呢？如果对这个 Key 操作，不要求顺序,这种情况下，准备一个分布式锁，大家去抢锁，抢到锁就做 set 操作即可，比较简单。
- 如果对这个 Key 操作，要求顺序.假设有一个 key1，系统 A 需要将 key1 设置为 valueA，系统 B 需要将 key1 设置为 valueB，系统 C 需要将 key1 设置为 valueC。期望按照 key1 的 value 值按照 valueA > valueB > valueC 的顺序变化。这种时候我们在数据写入数据库的时候，需要保存一个时间戳。

假设时间戳如下：

系统A key 1 {valueA 3:00}

系统B key 1 {valueB 3:05}

系统C key 1 {valueC 3:10}

那么，假设这会系统 B 先抢到锁，将 key1 设置为{valueB 3:05}。接下来系统 A 抢到锁，发现自己的 valueA 的时间戳早于缓存中的时间戳，那就不做 set 操作了，以此类推。

其他方法，比如利用队列，将 set 方法变成串行访问也可以。总之，灵活变通。

## 2.Redis集群

### 主从复制

**主从链(拓扑结构)**

![主从](/Users/mbpzy/images/format,png-20211012084213604-20211012085550655.png)

![主从](/Users/mbpzy/images/format,png-20211012085550666.png)

**复制模式**

- 全量复制:master 全部同步到 slave
- 部分复制:slave 数据丢失进行备份

**问题点**

- 同步故障
  - 复制数据延迟(不一致)
  - 读取过期数据(Slave 不能删除数据)
  - 从节点故障
  - 主节点故障
- 配置不一致
  - maxmemory 不一致:丢失数据
  - 优化参数不一致:内存不一致.
- 避免全量复制
  - 选择小主节点(分片)、低峰期间操作.
  - 如果节点运行 id 不匹配(如主节点重启、运行 id 发送变化),此时要执行全量复制,应该配合哨兵和集群解决.
  - 主从复制挤压缓冲区不足产生的问题(网络中断,部分复制无法满足),可增大复制缓冲区( rel_backlog_size 参数).
- 复制风暴

### 哨兵机制

![image](/Users/mbpzy/images/format,png-20211012084213782-20211012085550680.png)

**节点下线**

- 客观下线
  - 所有 Sentinel 节点对 Redis 节点失败要达成共识,即超过 quorum 个统一.
- 主管下线
  - 即 Sentinel 节点对 Redis 节点失败的偏见,超出超时时间认为 Master 已经宕机.

**leader选举**

- 选举出一个 Sentinel 作为 Leader:集群中至少有三个 Sentinel 节点,但只有其中一个节点可完成故障转移.通过以下命令可以进行失败判定或领导者选举.
- 选举流程
  1. 每个主观下线的 Sentinel 节点向其他 Sentinel 节点发送命令,要求设置它为领导者.
  1. 收到命令的 Sentinel 节点如果没有同意通过其他 Sentinel 节点发送的命令,则同意该请求,否则拒绝.
  1. 如果该 Sentinel 节点发现自己的票数已经超过 Sentinel 集合半数且超过 quorum,则它成为领导者.
  1. 如果此过程有多个 Sentinel 节点成为领导者,则等待一段时间再重新进行选举.

**故障转移**

- 转移流程
  1. Sentinel 选出一个合适的 Slave 作为新的 Master(slaveof no one 命令).
  1. 向其余 Slave 发出通知,让它们成为新 Master 的 Slave( parallel-syncs 参数).
  1. 等待旧 Master 复活,并使之称为新 Master 的 Slave.
  1. 向客户端通知 Master 变化.
- 从 Slave 中选择新 Master 节点的规则(slave 升级成 master 之后)
  1. 选择 slave-priority 最高的节点.
  1. 选择复制偏移量最大的节点(同步数据最多).
  1. 选择 runId 最小的节点.

**读写分离**

云数据库Redis读写分离版支持多个只读节点，能够为高并发且读多写少的场景提供合适的支持。

云数据库Redis版不管主从版还是集群规格，replica作为备库不对外提供服务，只有在发生HA的时候，replica提升为master后才承担读写流量。这种架构读写请求都在master上完成，一致性较高，但性能受到master数量的限制。经常有用户数据较少，但因为流量或者并发太高而不得不升级到更大的集群规格。

为满足读多写少的业务场景，最大化节约用户成本，云数据库Redis版推出了读写分离规格，为用户提供透明、高可用、高性能、高灵活的读写分离服务。

- 架构

Redis集群模式有redis-proxy、master、replica、HA等几个角色。在读写分离实例中，新增read-only replica角色来承担读流量，replica作为热备不提供服务，架构上保持对现有集群规格的兼容性。redis-proxy按权重将读写请求转发到master或者某个read-only replica上；HA负责监控DB节点的健康状态，异常时发起主从切换或重搭read-only replica，并更新路由。

一般来说，根据master和read-only replica的数据同步方式，可以分为两种架构：星型复制和链式复制。

- 星型复制

星型复制就是将所有的read-only replica直接和master保持同步，每个read-only replica之间相互独立，任何一个节点异常不影响到其他节点，同时因为复制链比较短，read-only replica上的复制延迟比较小。

Redis是单进程单线程模型，主从之间的数据复制也在主线程中处理，read-only replica数量越多，数据同步对master的CPU消耗就越严重，集群的写入性能会随着read-only replica的增加而降低。此外，星型架构会让master的出口带宽随着read-only replica的增加而成倍增长。Master上较高的CPU和网络负载会抵消掉星型复制延迟较低的优势，因此，星型复制架构会带来比较严重的扩展问题，整个集群的性能会受限于master。


![img](/Users/mbpzy/images/p3189.png)

- 链式复制

链式复制将所有的read-only replica组织成一个复制链，如下图所示，master只需要将数据同步给replica和复制链上的第一个read-only replica。

链式复制解决了星型复制的扩展问题，理论上可以无限增加read-only replica的数量，随着节点的增加整个集群的性能也可以基本上呈线性增长。

链式复制的架构下，复制链越长，复制链末端的read-only replica和master之间的同步延迟就越大，考虑到读写分离主要使用在对一致性要求不高的场景下，这个缺点一般可以接受。但是如果复制链中的某个节点异常，会导致下游的所有节点数据都会大幅滞后。更加严重的是这可能带来全量同步，并且全量同步将一直传递到复制链的末端，这会对服务带来一定的影响。为了解决这个问题，读写分离的Redis都使用阿里云优化后的binlog复制版本，最大程度的降低全量同步的概率。


![img](/Users/mbpzy/images/p3191.png)

结合上述的讨论和比较，Redis读写分离选择链式复制的架构。

**Redis读写分离优势**

- 透明兼容

读写分离和普通集群规格一样，都使用了redis-proxy做请求转发，多分片令使用存在一定的限制，但从主从升级单分片读写分离，或者从集群升级到多分片的读写分离集群可以做到完全兼容。

用户和redis-proxy建立连接，redis-proxy会识别出客户端连接发送过来的请求是读还是写，然后按照权重作负载均衡，将请求转发到后端不同的DB节点中，写请求转发给master，读操作转发给read-only replica（master默认也提供读，可以通过权重控制）。

用户只需要购买读写分离规格的实例，直接使用任何客户端即可直接使用，业务不用做任何修改就可以开始享受读写分离服务带来的巨大性能提升，接入成本几乎为0。

- 高可用

高可用模块（HA）监控所有DB节点的健康状态，为整个实例的可用性保驾护航。master宕机时自动切换到新主。如果某个read-only replica宕机，HA也能及时感知，然后重搭一个新的read-only replica，下线宕机节点。

除HA之外，redis-proxy也能实时感知每个read-only replica的状态。在某个read-only replica异常期间，redis-proxy会自动降低这个节点的权重，如果发现某个read-only replica连续失败超过一定次数以后，会暂时屏蔽异常节点，直到异常消失以后才会恢复其正常权重。

redis-proxy和HA一起做到尽量减少业务对后端异常的感知，提高服务可用性。

- 高性能

对于读多写少的业务场景，直接使用集群版本往往不是最合适的方案，现在读写分离提供了更多的选择，业务可以根据场景选择最适合的规格，充分利用每一个read-only replica的资源。

目前单shard对外售卖1 master + 1/3/5 read-only replica多种规格（如果有更大的需求可以提工单反馈），提供60万QPS和192 MB/s的服务能力，在完全兼容所有命令的情况下突破单机的资源限制。后续将去掉规格限制，让用户根据业务流量随时自由的增加或减少read-only replica数量。

| 规格                           | QPS             | 带宽      |
| :----------------------------- | :-------------- | :-------- |
| 1 master                       | 8-10万读写      | 10-48 MB  |
| 1 master + 1 read-only replica | 10万写 + 10万读 | 20-64 MB  |
| 1 master + 3 read-only replica | 10万写 + 30万读 | 40-128 MB |
| 1 master + 5 read-only replica | 10万写 + 50万读 | 60-192 MB |

后续

Redis主从异步复制，从read-only replica中可能读到旧的数据，使用读写分离需要业务可以容忍一定程度的数据不一致，后续将会给客户更灵活的配置和更大的自由，例如配置可以容忍的最大延迟时间。

**定时任务**

- 每 1s 每个 Sentinel 对其他 Sentinel 和 Redis 执行 ping,进行心跳检测.
- 每 2s 每个 Sentinel 通过 Master 的 Channel 交换信息(pub - sub).
- 每 10s 每个 Sentinel 对 Master 和 Slave 执行 info,目的是发现 Slave 节点、确定主从关系.

### 分布式集群(Cluster)

**拓扑图**

![image](/Users/mbpzy/images/format,png-20211012084213765-20211012085550683.png)

**通讯**

- ​	集中式

  > 将集群元数据(节点信息、故障等等)几种存储在某个节点上.

  - 优势

    1.元数据的更新读取具有很强的时效性,元数据修改立即更新

  - 劣势

    1.数据集中存储

- Gossip

![image](/Users/mbpzy/images/format,png-20211012084213703-20211012085550716.png)

**寻址分片**

- ##### hash取模

  - hash(key)%机器数量

  - 问题

    1.机器宕机,造成数据丢失,数据读取失败

    2.伸缩性

- **一致性hash**
  - 一致性哈希算法在节点太少时，容易因为节点分布不均匀而造成缓存热点的问题。
  - 解决方案：可以通过引入虚拟节点机制解决：即对每一个节点计算多个 hash，每个计算结果位置都放置一个虚拟节点。这样就实现了数据的均匀分布，负载均衡。

![image](/Users/mbpzy/images/format,png-20211012084213827-20211012085550690.png)

- ##### hash槽 ：CRC16(key)%16384

- ![image](/Users/mbpzy/images/format,png-20211012084213869-20211012085550671.png)

**使用场景**

热点数据、会话维持 session、分布式锁 SETNX、表缓存、消息队列 list、计数器 string

**更新策略**

- LRU、LFU、FIFO 算法自动清除:一致性最差,维护成本低.
- 超时自动清除(key expire):一致性较差,维护成本低.
- 主动更新:代码层面控制生命周期,一致性最好,维护成本高.

**更新一致性**

- 读请求:先读缓存,缓存没有的话,就读数据库,然后取出数据后放入缓存,同时返回响应.
- 写请求:先删除缓存,然后再更新数据库(避免大量地写、却又不经常读的数据导致缓存频繁更新).

**缓存粒度**

- 通用性:全量属性更好.
- 占用空间:部分属性更好.
- 代码维护成本.

**缓存穿透**

> 当大量的请求无命中缓存、直接请求到后端数据库(业务代码的 bug、或恶意攻击),同时后端数据库也没有查询到相应的记录、无法添加缓存.
>
> 这种状态会一直维持,流量一直打到存储层上,无法利用缓存、还会给存储层带来巨大压力.

**解决方案**

1. 请求无法命中缓存、同时数据库记录为空时在缓存添加该 key 的空对象(设置过期时间)，缺点是可能会在缓存中添加大量的空值键(比如遭到恶意攻击或爬虫)，而且缓存层和存储层数据短期内不一致；
1. 使用布隆过滤器在缓存层前拦截非法请求、自动为空值添加黑名单(同时可能要为误判的记录添加白名单).但需要考虑布隆过滤器的维护(离线生成/ 实时生成).

**缓存雪崩**

> 缓存崩溃时请求会直接落到数据库上,很可能由于无法承受大量的并发请求而崩溃,此时如果只重启数据库,或因为缓存重启后没有数据,新的流量进来很快又会把数据库击倒

**出现后应对**

- 事前:Redis 高可用,主从 + 哨兵,Redis Cluster,避免全盘崩溃.
- 事中:本地 ehcache 缓存 + hystrix 限流 & 降级,避免数据库承受太多压力.
- 事后:Redis 持久化,一旦重启,自动从磁盘上加载数据,快速恢复缓存数据.

**请求过程**

1. 用户请求先访问本地缓存,无命中后再访问 Redis,如果本地缓存和 Redis 都没有再查数据库,并把数据添加到本地缓存和 Redis；
1. 由于设置了限流,一段时间范围内超出的请求走降级处理(返回默认值,或给出友情提示)

## 2.Redlock

### 什么是 RedLock

Redis 官方站这篇文章提出了一种权威的基于 Redis 实现分布式锁的方式名叫 *Redlock*，此种方式比原先的单节点的方法更安全。它可以保证以下特性：

1. 安全特性：互斥访问，即永远只有一个 client 能拿到锁
1. 避免死锁：最终 client 都可能拿到锁，不会出现死锁的情况，即使原本锁住某资源的 client crash 了或者出现了网络分区
1. 容错性：只要大部分 Redis 节点存活就可以正常提供服务

#### 怎么在单节点上实现分布式锁

> SET resource_name my_random_value NX PX 30000

主要依靠上述命令，该命令仅当 Key 不存在时（NX保证）set 值，并且设置过期时间 3000ms （PX保证），值 my_random_value 必须是所有 client 和所有锁请求发生期间唯一的，释放锁的逻辑是：

```lua
if redis.call("get",KEYS[1]) == ARGV[1] then
    return redis.call("del",KEYS[1])
else
    return 0
end
```

上述实现可以避免释放另一个client创建的锁，如果只有 del 命令的话，那么如果 client1 拿到 lock1 之后因为某些操作阻塞了很长时间，此时 Redis 端 lock1 已经过期了并且已经被重新分配给了 client2，那么 client1 此时再去释放这把锁就会造成 client2 原本获取到的锁被 client1 无故释放了，但现在为每个 client 分配一个 unique 的 string 值可以避免这个问题。至于如何去生成这个 unique string，方法很多随意选择一种就行了。

#### Redlock 算法

算法很易懂，起 5 个 master 节点，分布在不同的机房尽量保证可用性。为了获得锁，client 会进行如下操作：

1. 得到当前的时间，微秒单位
1. 尝试顺序地在 5 个实例上申请锁，当然需要使用相同的 key 和 random value，这里一个 client 需要合理设置与 master 节点沟通的 timeout 大小，避免长时间和一个 fail 了的节点浪费时间
1. 当 client 在大于等于 3 个 master 上成功申请到锁的时候，且它会计算申请锁消耗了多少时间，这部分消耗的时间采用获得锁的当下时间减去第一步获得的时间戳得到，如果锁的持续时长（lock validity time）比流逝的时间多的话，那么锁就真正获取到了。
1. 如果锁申请到了，那么锁真正的 lock validity time 应该是 origin（lock validity time） - 申请锁期间流逝的时间
1. 如果 client 申请锁失败了，那么它就会在少部分申请成功锁的 master 节点上执行释放锁的操作，重置状态

#### 失败重试

如果一个 client 申请锁失败了，那么它需要稍等一会在重试避免多个 client 同时申请锁的情况，最好的情况是一个 client 需要几乎同时向 5 个 master 发起锁申请。另外就是如果 client 申请锁失败了它需要尽快在它曾经申请到锁的 master 上执行 unlock 操作，便于其他 client 获得这把锁，避免这些锁过期造成的时间浪费，当然如果这时候网络分区使得 client 无法联系上这些 master，那么这种浪费就是不得不付出的代价了。

#### 放锁

放锁操作很简单，就是依次释放所有节点上的锁就行了

#### 性能、崩溃恢复和 fsync

如果我们的节点没有持久化机制，client 从 5 个 master 中的 3 个处获得了锁，然后其中一个重启了，这是注意 **整个环境中又出现了 3 个 master 可供另一个 client 申请同一把锁！** 违反了互斥性。如果我们开启了 AOF 持久化那么情况会稍微好转一些，因为 Redis 的过期机制是语义层面实现的，所以在 server 挂了的时候时间依旧在流逝，重启之后锁状态不会受到污染。但是考虑断电之后呢，AOF部分命令没来得及刷回磁盘直接丢失了，除非我们配置刷回策略为 fsnyc = always，但这会损伤性能。解决这个问题的方法是，当一个节点重启之后，我们规定在 max TTL 期间它是不可用的，这样它就不会干扰原本已经申请到的锁，等到它 crash 前的那部分锁都过期了，环境不存在历史锁了，那么再把这个节点加进来正常工作。

## 3.分布锁框架Redisson

Redisson是一个在Redis的基础上实现的Java驻内存数据网格（In-Memory Data Grid）。

它不仅提供了一系列的分布式的Java常用对象，还提供了许多分布式服务，其中包括(BitSet, Set, Multimap, SortedSet, Map, List, Queue, BlockingQueue, Deque, BlockingDeque, Semaphore, Lock, AtomicLong, CountDownLatch, Publish / Subscribe, Bloom filter, Remote service, Spring cache, Executor service, Live Object service, Scheduler service) 

Redisson提供了使用Redis的最简单和最便捷的方法。Redisson的宗旨是促进使用者对Redis的关注分离（Separation of Concern），从而让使用者能够将精力更集中地放在处理业务逻辑上。

### Redission实现分布式锁原理

**一、高效分布式锁**

高效分布式锁需要考虑的问题：

- **互斥**

  在分布式高并发的条件下，我们最需要保证，同一时刻只能有一个线程获得锁，这是最基本的一点。

- **防止死锁**

  在分布式高并发的条件下，比如有个线程获得锁的同时，还没有来得及去释放锁，就因为系统故障或者其它原因使它无法执行释放锁的命令,导致其它线程都无法获得锁，造成死锁。所以分布式非常有必要设置锁的 `有效时间 `，确保系统出现故障后，在一定时间内能够主动去释放锁，避免造成死锁的情况。

- **性能**

  对于访问量大的共享资源，需要考虑减少锁等待的时间，避免导致大量线程阻塞。所以在锁的设计时，需要考虑两点:

  1. **锁的颗粒度要尽量小**
     比如你要通过锁来减库存，那这个锁的名称你可以设置成是商品的ID,而不是任取名称。这样这个锁只对当前商品有效,锁的颗粒度小。

  1. **锁的范围尽量要小** 

     比如只要锁2行代码就可以解决问题的，那就不要去锁10行代码了。

- **重入**

  我们知道ReentrantLock是可重入锁，那它的特点就是：同一个线程可以重复拿到同一个资源的锁。重入锁非常有利于资源的高效利用。

针对以上Redisson都能很好的满足，下面就来分析下它。

**二、Redisson原理分析**

![preview](/Users/mbpzy/images/view.jpeg)

### 1.加锁机制

线程去获取锁，获取成功: 执行lua脚本，保存数据到redis数据库。

线程去获取锁，获取失败: 一直通过while循环尝试获取锁，获取成功后，执行lua脚本，保存数据到redis数据库。

### 2.watch dog自动延期机制

这个比较难理解，找了些许资料感觉也并没有解释的很清楚。这里我自己的理解就是:

在一个分布式环境下，假如一个线程获得锁后，突然服务器宕机了，那么这个时候在一定时间后这个锁会自动释放，你也可以设置锁的有效时间(不设置默认30秒），这样的目的主要是防止死锁的发生。

但在实际开发中会有下面一种情况:

```java
            //设置锁1秒过去
            redissonLock.lock("redisson", 1);
            /**
             * 业务逻辑需要咨询2秒
             */
            redissonLock.release("redisson");
    
          /**
           * 线程1 进来获得锁后，线程一切正常并没有宕机，但它的业务逻辑需要执行2秒，这就会有个问题，在 线程1 执行1秒后，这个锁就自动过期了，那么这个时候 线程2 进来了。那么就存在 线程1和线程2 同时在这段业务逻辑里执行代码，这当然是不合理的。而且如果是这种情况，那么在解锁时系统会抛异常，因为解锁和加锁已经不是同一线程了.
           */
    
```

所以这个时候 `看门狗 `就出现了，它的作用就是 线程1 业务还没有执行完，时间就过了，线程1 还想持有锁的话，就会启动一个watch dog后台线程，不断的延长锁key的生存时间。

`注意 `正常这个看门狗线程是不启动的，还有就是这个看门狗启动后对整体性能也会有一定影响，所以不建议开启看门狗。

### 3.为啥要用lua脚本呢？

这个不用多说，主要是如果你的业务逻辑复杂的话，通过封装在lua脚本中发送给redis，而且redis是单线程的，这样就保证这段复杂业务逻辑执行的原子性 。

### 4.可重入加锁机制

Redisson可以实现可重入加锁机制的原因，我觉得跟两点有关：

```mathematica
    1.Redis存储锁的数据类型是 Hash类型
    2.Hash数据类型的key值包含了当前线程信息。
```

下面是redis存储的数据
![img](/Users/mbpzy/images/1460000022355786.jpeg)

这里表面数据类型是Hash类型,Hash类型相当于我们java的 `<key,<key1,value>> `类型,这里key是指 'redisson'，它的有效期还有9秒，我们再来看里们的key1值为 `078e44a3-5f95-4e24-b6aa-80684655a15a:45 `它的组成是guid + 当前线程的ID。后面的value是就和可重入加锁有关。

**举图说明**

![img](/Users/mbpzy/images/1460000022355787.jpeg)

上面这图的意思就是可重入锁的机制，它最大的优点就是相同线程不需要在等待锁，而是可以直接进行相应操作。

### 5.Redis分布式锁的缺点

Redis分布式锁会有个缺陷，就是在Redis哨兵模式下:

`客户端1 `对某个 `master`节点 写入了redisson锁，此时会异步复制给对应的` slave`节点。但是这个过程中一旦发生`master`节点宕机，主备切换，`slave`节点从变为了 `master`节点。

这时 `客户端2 `来尝试加锁的时候，在新的`master`节点上也能加锁，此时就会导致多个客户端对同一个分布式锁完成了加锁。

这时系统在业务语义上一定会出现问题， **导致各种脏数据的产生** 。

`缺陷 `在哨兵模式或者主从模式下，如果 master实例宕机的时候，可能导致多个客户端同时完成加锁。


### 程序化配置方法

Redisson程序化的配置方法是通过构建Config对象实例来实现的。例如

```java
Config config = new Config();
config.setTransportMode(TransportMode.EPOLL);
//可以用"rediss://"来启用SSL连接
config.useClusterServers().addNodeAddress("redis://127.0.0.1:7181");
```

### 文件方式配置

Redisson既可以通过用户提供的JSON或YAML格式的文本文件来配置，也可以通过含有Redisson专有命名空间的，Spring框架格式的XML文本文件来配置。

```java
Config config = Config.fromJSON(new File("config-file.json"));
RedissonClient redisson = Redisson.create(config);
```

也通过调用config.fromYAML方法并指定一个File实例来实现读取YAML格式的配置：

```java
Config config = Config.fromYAML(new File("config-file.yaml"));
RedissonClient redisson = Redisson.create(config);
```

### 集群模式

集群模式除了适用于Redis集群环境，也适用于任何云计算服务商提供的集群模式，例如AWS ElastiCache集群版、Azure Redis Cache和阿里云（Aliyun）的云数据库Redis版。

程序化配置集群的用法:

```java
Config config = new Config();
config.useClusterServers()
    .setScanInterval(2000) // 集群状态扫描间隔时间，单位是毫秒
    //可以用"rediss://"来启用SSL连接
    .addNodeAddress("redis://127.0.0.1:7000", "redis://127.0.0.1:7001")
    .addNodeAddress("redis://127.0.0.1:7002");

RedissonClient redisson = Redisson.create(config);
```

### 主从模式

```java
Config config = new Config();
config.useMasterSlaveServers()
    //可以用"rediss://"来启用SSL连接
    .setMasterAddress("redis://127.0.0.1:6379")
    .addSlaveAddress("redis://127.0.0.1:6389", "redis://127.0.0.1:6332", "redis://127.0.0.1:6419")
    .addSlaveAddress("redis://127.0.0.1:6399");

RedissonClient redisson = Redisson.create(config);
```

### RedissonLock分布式锁的代码

```java
public class RedissonLock {
		private static RedissonClient redissonClient;
		static{
			Config config = new Config();
			config.useSingleServer().setAddress("redis://127.0.0.1:6379").setPassword(null);
//			config.useSingleServer().setAddress("redis://192.168.188.4:6380").setPassword("ty3foGTrNiKi");
			redissonClient = Redisson.create(config);
		}
		
		public static RedissonClient getRedisson(){
			return redissonClient;
		}
		
		
	public static void main(String[] args) throws InterruptedException{
	
		RLock fairLock = getRedisson().getLock("TEST_KEY");
		System.out.println(fairLock.toString());
//		fairLock.lock(); 
		// 尝试加锁，最多等待10秒，上锁以后10秒自动解锁
		boolean res = fairLock.tryLock(10, 10, TimeUnit.SECONDS);
		System.out.println(res);
		fairLock.unlock();
		
		//有界阻塞队列
		RBoundedBlockingQueue<JSONObject> queue = getRedisson().getBoundedBlockingQueue("anyQueue");
		// 如果初始容量（边界）设定成功则返回`真（true）`，
		// 如果初始容量（边界）已近存在则返回`假（false）`。
		System.out.println(queue.trySetCapacity(10));
		JSONObject o=new JSONObject();
		o.put("name", 1);
		if(!queue.contains(o)){
			queue.offer(o);
		}
		
		JSONObject o2=new JSONObject();
		o2.put("name", 2);
		// 此时容量已满，下面代码将会被阻塞，直到有空闲为止。
		
		if(!queue.contains(o2)){
			queue.offer(o2);
		}
		
		//  获取但不移除此队列的头；如果此队列为空，则返回 null。
		JSONObject obj = queue.peek();
		//获取并移除此队列的头部，在指定的等待时间前等待可用的元素（如果有必要）。
		JSONObject ob = queue.poll(10, TimeUnit.MINUTES);                                                    
		
		//获取并移除此队列的头，如果此队列为空，则返回 null。
		 Iterator<JSONObject> iterator=queue.iterator();
		 while (iterator.hasNext()){
			  JSONObject i =iterator.next();
		      System.out.println(i.toJSONString());
		      iterator.remove();
		    
		  }
			while(queue.size()>0){
				JSONObject obs = queue.poll();     
				System.out.println(obs.toJSONString());
			}
		
		JSONObject someObj = queue.poll();
		System.out.println(someObj.toJSONString());
	}
}

```

