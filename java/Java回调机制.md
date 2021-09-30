## 两个经典例子让你彻底理解Java回调机制

 **前言**

先让我们通过一个生活中的场景来还原一下回调的场景：你遇到了一个技术难题，于是你去咨询大牛，大牛说现在正在忙，待会儿告诉你结果。

此时，你可能会去刷朋友圈了，等大牛忙完之后，告诉你答案是2。

那么，这个过程中询问问题(调用对方接口)，然后问题解决之后再告诉你(对方处理完再调用你，通知结果)，这一过程便是回调。

**系统调用的分类**

应用系统模块之间的调用，通常分为：同步调用，异步调用，回调。

[![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/608ea4f53542a0b985a02aceb9b0b757.jpg-wh_600x-s_704523672.jpg)](https://s2.51cto.com/oss/202102/07/608ea4f53542a0b985a02aceb9b0b757.jpg-wh_600x-s_704523672.jpg)

**同步调用**

同步调用是最基本的调用方式。类A的a()方法调用类B的b()方法，类A的方法需要等到B类的方法执行完成才会继续执行。如果B的方法长时间阻塞，就会导致A类方法无法正常执行下去。

[![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/ca4baf1164f0ce2d4b9b0d7df85cfb65.jpg-wh_600x-s_795989289.jpg)](https://s6.51cto.com/oss/202102/07/ca4baf1164f0ce2d4b9b0d7df85cfb65.jpg-wh_600x-s_795989289.jpg)

**异步调用**

如果A调用B，B的执行时间比较长，那么就需要考虑进行异步处理，使得B的执行不影响A。通常在A中新建一个线程用来调用B，然后A中的代码继续执行。

异步通常分两种情况：第一，不需要调用结果，直接调用即可，比如发送消息通知;第二，需要异步调用结果，在Java中可使用Future+Callable实现。

[![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/fab6556bab9a71e80ac493144411e1b9.jpg-wh_600x-s_3521158042.jpg)](https://s6.51cto.com/oss/202102/07/fab6556bab9a71e80ac493144411e1b9.jpg-wh_600x-s_3521158042.jpg)

**回调**

通过上图我们可以看到回到属于一种双向的调用方式。回调的基本上思路是：A调用B，B处理完之后再调用A提供的回调方法(通常为callback())通知结果。

通常回调分为：同步回调和异步回调。网络上大多数的回调案例都是同步回调。

其中同步回调与同步调用类似，代码运行到某一个位置的时候，如果遇到了需要回调的代码，会在这里等待，等待回调结果返回后再继续执行。

而异步回调与异步调用类似，代码执行到需要回调的代码的时候，并不会停下来，而是继续执行，当然可能过一会回调的结果会返回回来。

**同步回调实例**

下面我们以同步回调为例来讲解回调的Java代码实现。整个过程就模拟上面问答问题的场景。

首先，定义给一个CallBack的接口，将回调的功能进行单独抽离：

```java
public interface CallBack {     void callback(String string); } 
```

CallBack接口中提供了一个callback方法，用于回调时调用。

然后定义问问题的人Person：

```java
public class Person implements CallBack {
    private Genius genius;

    public Person(Genius genius) {
        this.genius = genius;
    }

    @Override
    public void callback(String string) {
        System.out.println("收到答案：" + string);
    }

    public void ask() {
        genius.answer(this);
    }
} 
```

由于Person要提供回调方法，因此实现CallBack接口及其方法，方法中主要针对回调结果进行处理。

同时，由于Person要调用Genius对应的方法，因此要持有Genius的引用，这里通过构造方法传入。

定义回答问题的大神Genius类：

```java
public class Genius {
    public void answer(CallBack callBack) {
        System.out.println("在忙其他事...");
        try {
            Thread.sleep(2000);
            System.out.println("忙完其他事，开始计算...");
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("天才计算出答案为：2");         // 回调告诉你         
        callBack.callback("2");
    }
} 
```

这模拟大神正在忙碌，线程睡眠2秒，忙碌完之后，开始帮忙计算答案，获得答案之后，调用CallBack接口的callback方法进行回调，通知结果。

通过Main方法进行测试：

```java
public static void main(String[] args) {
        Genius genius = new Genius();
        Person you = new Person(genius);
        you.ask();
} 
```

执行打印结果如下：

```bash
在忙其他事... 忙完其他事，开始计算... 天才计算出答案为：2 收到答案：2 
```

上面的过程，就实现了一个同步回调的功能。当然，从程序设计上来说，可以对Person和Genius进一步抽象化处理，通过接口的形式呈现。

在上述回调机制的代码实现中，最核心的是在调用answer方法时传递了this参数，即调用者自身。

从本质上来说，回调是一种思想，是一种机制，至于具体如何实现，如何通过代码将回调实现得优雅、实现得可扩展性比较高，就需要八仙过海各显神通了。

**异步回调实例**

上面的实例演示了同步回调，很明显在调用的过受到Genius执行时长的影响，需要等到Genius处理完才能继续执行Person方法中的后续代码。

下面在上述示例上进行改进，Person提供一个支持异步回调的方法：

```java
public void askASyn() {
        System.out.println("创建新线程请教问题");
        new Thread(() -> genius.answer(this)).start();
        System.out.println("新线程已启动...");
} 
```

在该方法内，新建了一个线程用来处理Genius#answer方法的调用，这样就能够跳过Genius#answer方法的阻塞，直接执行下面的操作(日志打印)。

在main方法中将调用的方法改为askASyn，打印结果如下：

```bash
创建新线程请教问题 新线程已启动... 在忙其他事... 忙完其他事，开始计算... 天才计算出答案为：2 收到答案：2 
```

可以看出，直接打印了“新线程已启动...”，后续才打印出Genius#answer方法方法中处理日志和回调时callback方法接收到的信息。

**基于Future的半异步**

除了上述的同步，异步处理，还有一种介于同步和异步之间的基于Future的半异步处理。

在Java使用nio后无法立即拿到真实的数据，而是先得到一个"future"，可以理解为邮戳或快递单，为了获悉真正的数据我们需要不停的通过快递单号"future"查询快递是否真正寄到。

Futures是一个抽象的概念，它表示一个值，在某一点会变得可用。一个Future要么获得计算完的结果，要么获得计算失败后的异常。

通常什么时候会用到Future呢?一般来说，当执行一个耗时的任务时，使用Future就可以让线程暂时去处理其他的任务，等长任务执行完毕再返回其结果。

经常会使用到Future的场景有：1. 计算密集场景。2. 处理大数据量。3. 远程方法调用等。

Java在java.util.concurrent包中附带了Future接口，它使用Executor异步执行。

例如下面的代码，每传递一个Runnable对象到ExecutorService.submit()方法就会得到一个回调的Future，使用它检测是否执行，这种方法可以是同步等待线处理结果完成。

```java
public class TestFuture {

    public static void main(String[] args) {

        //实现一个Callable接口 
        Callable<User> c = () -> {
            //这里是业务逻辑处理 

            //让当前线程阻塞1秒看下效果 
            Thread.sleep(1000);
            return new User("张三");
        };

        ExecutorService es = Executors.newFixedThreadPool(2);

        // 记得要用submit，执行Callable对象 
        Future<User> fn = es.submit(c);
        // 一定要调用这个方法，不然executorService.isTerminated()永远不为true 
        es.shutdown();
        // 无限循环等待任务处理完毕  如果已经处理完毕 isDone返回true 
        while (!fn.isDone()) {
            try {
                //处理完毕后返回的结果 
                User nt = fn.get();
                System.out.println(nt.name);
            } catch (InterruptedException | ExecutionException e) {
                e.printStackTrace();
            }
        }
    }

    static class User {
        private String name;

        private User(String name) {
            this.name = name;
        }
    }
} 
```

此种情况下虽然是创建了新线程来进行处理，但还是需要等待处理的结果。好处是可以将批量的处理，分为几个线程同时进行处理，最后对结果进行合并，达到提升处理效率的目的。

**小结**

经过这篇文章，想必大家对Java的回调机制已经有所了解，在各类开源框架中，其实也会经常看到回调的使用，活学活用。

## 