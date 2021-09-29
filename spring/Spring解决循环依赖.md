## Spring解决循环依赖

### 1.什么是循环依赖

有一个 A 对象，创建 A 的时候发现 A 对象依赖 B，然后去创建 B 对象的时候，又发现 B 对象依赖 C，然后去创建 C 对象的时候，又发现 C 对象依赖 A。这就是对象之间的循环依赖，而当程序执行这样的逻辑时，通常会陷入死循环，而这样的依赖关系在我们的程序中又是没办法避免的，所以如何去解决循环依赖带来的问题就需要我们去思考的。

![img](/Users/mbpzy/images/v2-8adcdf4848cfab7d68450bd8be394259_1440w.jpg)

### 2.**产生循环依赖问题的前提条件**

其实并非所有的循环依赖关系都会导致问题，**如果系统允许存在多个同样的对象情况下，大家都可以自己创建一份自己所依赖的对象，那么这种情况其实循环依赖就没有任何问题**。而当**只有在依赖的对象都只有唯一一份的情况下，这个时候那我们创建对象的时候才会导致死循环**的逻辑。

也正因为Spring管理的Bean默认都是**单例**的，这些对象在Spring容器里面都**只有唯一一份**，所以Spring创建bean的时候就必需要考虑到不能重复创建对象，否则也就违背了单例的原则，所以这个时候就需要考虑到循环依赖的情况。

### 3.**Spring 解决循环依赖的思路**

Spring解决循环依赖的核心是三个缓存加一个标记，下面我们来详细了解下，Spring是如何通过这三个缓存加一个标记来完成循环依赖的对象创建的。

#### 1.**Spring创建对象的两个阶段**

首先我们需要了解下Spring创建对象包括对象的实例化和属性注入两个阶段，只有完成了实例化和属性注入才算是真正创建完成了，实例化的工作主要是通过对象构造方法实例化对象的过程，属性注入就是把对象锁依赖的属性进行赋值的过程。

#### 2.**Spring的三级缓存**

一级缓存：保存所有已经创建完成的bean。

二级缓存：保存正常创建中的bean (完成了实例化，但还未完成属性注入)。

三级缓存：保存的是ObjectFactory类型的对象的工厂，通过工厂的方法可以获取到目标对象。

标记缓存：保存着正在创建中的对象名称。

在源码DefaultSingletonBeanRegistry 类里定义了这几个缓存

```java
    //一级缓存，保存所有已经创建完成的bean
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

    //二级缓存，保存的是未完成创建的bean
    private final Map<String, Object> earlySingletonObjects = new HashMap<>(16);

    //三级缓存，一个创建对象的工厂（其实就是根据这个工厂可以生产或者拿到一个对象）
    private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);

```

#### 3.循环依赖的解决方法

第一步：尝试从缓存获取A对象

第二步：实例化A对象

第三步：A对象进行属性注入

第四步：实例化B对象

第五步：B对象进行属性注入

第六步：B对象创建完成

第七步：完成A对象的属性注入

### 4.**循环依赖案例**

下面我们来结合一个实际的循环依赖案例来理解，Spring是怎么通过三级缓存来解决单例对象循环依赖的问题的。

对象A和对象B 通过属性注入的方式产生了循环依赖，程序代码如下：

```java
@Component
public class ObjectA {

    @Autowired
    private  ObjectB b;

}
@Component
public class ObjectB {

    @Autowired
    private  ObjectA a;
}
```



首先我们Spring初始化，然后三级缓存和标记缓存内容都还是空的

![img](/Users/mbpzy/images/v2-888d5f9d61bdddfeb4a62fc7f47f0368_1440w.jpg)

**第一步：尝试从缓存获取A对象**

在每次创建对象之前，Spring首先会尝试从缓存获取对象，但显然A还没有创建过，所以从缓存获取不到，所以会执行下面的对象实例化流程，尝试创建A对象。

**第二步：实例化A对象**

这一步会进行A对象的实例化，首先会在标记缓存里标记A正在创建中，然后调用构造方法进行实例化，再把自己放到一个ObjectFactory工厂里再保存到三级缓存。

![img](/Users/mbpzy/images/v2-762386ba1a5010ff251582d9ff5d2f9d_1440w.jpg)

**第三步：A对象进行属性注入**

我们发现A需要依赖于B对象，所以完成A要完成创建首先需要获得B，所以这时候会尝试从一级缓存获取B对象，但是此时一级缓存没有；然后我们会看B对象是否正处于创建中，显然现在B也还未开始创建，所以这个时候容器会先去创建完B对象，等拿到B对象的之后，然后再回来完成A的属性注入。

**第四步：实例化B对象**

尝试创建对象B之前，容器还是会尝试先从缓存里面查找，然而没找到；这才真正决定进行B对象的实例化，首先会标记B正在创建中，然后调用构造方法进行实例化，再把自己放到一个ObjectFactory工厂对象里保存到三级缓存里。

![img](/Users/mbpzy/images/v2-968e005076da20d9fabc1c83c2dd6e1c_1440w.jpg)



**第五步：B对象进行属性注入**

进行属性注入的时候，我们发现B的属性需要依赖于A对象，到这里sping也还是会尝试从缓存获取，先查看一级缓存有没有A对象，但是此时一级缓存没有A对象；

然后再看A对象是否正处于创建中（这时知道了A正处于创建中），所以就继续从二级缓存中去获取B（二级缓存也没有），最后去三级缓存里面找（此时A对象存在于三级缓存），从三级缓存里获得一个ObjectFactory，然后调用ObjectFactory.getObject()方法得到了A对象。拿到A对象后 这里会把A对象从三级缓存移出，然后把A保存到二级缓存。

![img](/Users/mbpzy/images/v2-28c946bcecc853cd80d0e95978aa335d_1440w.jpg)



**第六步：B对象创建完成**

拿到A对象后，spring把A对象的引用赋值给B对象的属性，然后B就完成了创建，最后会把B对象从三级缓存移出，保存到一级缓存里去，同时也会移出创建中的标记。

![img](/Users/mbpzy/images/v2-b31bf551ffe95976a2b6d5264ffef724_1440w.jpg)

**第七步：完成A对象的属性注入**

这个时候，我们的代码流程会返回到第三步，容器已经拿到了B对象了，所以可以继续完成A对象的属性注入工作了。

拿到B对象后，然后把B对象引用赋值给A的属性,最后同样也会把A对象从二级缓存移出，保存到一级缓存里去，同时也会移出创建中的标记。

![img](/Users/mbpzy/images/v2-73df2b553e24e9c2694313add6e6cbdb_1440w.jpg)



最后通过三个缓存和一个标记最终就完成了整个循环依赖对象的创建，这里只是针对一个简单的循环依赖场景做了一个案例，其他复杂场景通过这个逻辑你也知道是怎么个流程了。

### 5.**二级缓存和三缓存的区别**

基本上Spring是怎么解决循环依赖的问题你已经明白了，也许你脑子里会有一个疑问，就是好像始终不明白二级缓存三级缓存他们两个的区别是什么，因为通过上面的案例来看，好像根本不需要三个缓存，只需要两个就行了。的确开始我也有同样的疑问，所以我就根据源码一探究竟，直到我发现保存三级缓存的一处代码

```java
//如果bean正在创建中并且完成了实例化，则把当前bean的获取方式保存到singletonFactories三级缓存中
addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));
        
protected void addSingletonFactory(String beanName, ObjectFactory<?> singletonFactory) {
        Assert.notNull(singletonFactory, "Singleton factory must not be null");
        synchronized (this.singletonObjects) {
            if (!this.singletonObjects.containsKey(beanName)) {
                DebugUtil.debug5(beanName);
                this.singletonFactories.put(beanName, singletonFactory);
                this.earlySingletonObjects.remove(beanName);
                this.registeredSingletons.add(beanName);
            }
        }
    }
```

原来保存到三级缓存的是getEarlyBeanReference()这个方法的逻辑，那么当我们调用从三级缓存里获取对象singletonFactory.getObject()的时候其实调用的是getEarlyBeanReference（）方法。

```java
    protected Object getEarlyBeanReference(String beanName, RootBeanDefinition mbd, Object bean) {
        Object exposedObject = bean;
        if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
            for (BeanPostProcessor bp : getBeanPostProcessors()) {
                if (bp instanceof SmartInstantiationAwareBeanPostProcessor) {
                    SmartInstantiationAwareBeanPostProcessor ibp = (SmartInstantiationAwareBeanPostProcessor) bp;
                    exposedObject = ibp.getEarlyBeanReference(exposedObject, beanName);
                }
            }
        }
        return exposedObject;
    }
```

这个方法里面可能会通过exposedObject = ibp.getEarlyBeanReference(exposedObject, beanName);获取对象。当这里BeanPostProcessor 类型为AbstractAutowireCapableBeanFactory 时会执行如下代码：

```java
/**
     * 尝试获取早期代理对象的引用
     * @param bean the raw bean instance
     * @param beanName the name of the bean
     * @return
     * @throws BeansException
     */
    @Override
    public Object getEarlyBeanReference(Object bean, String beanName) throws BeansException {
        Object cacheKey = getCacheKey(bean.getClass(), beanName);
        if (!this.earlyProxyReferences.contains(cacheKey)) {
            this.earlyProxyReferences.add(cacheKey);
        }
        return wrapIfNecessary(bean, beanName, cacheKey);
    }
```

执行 AbstractAutowireCapableBeanFactory 对象的getEarlyBeanReference()方法后返回的是一个**代理对象**。

我想一看到代理对象你大概应该已经明白了二级缓存和三级缓存的区别，从这里可以看出来，三级缓存里把最原始的对象封装到ObjectFactory 工厂对象的逻辑里，而这时候对象是不稳定的，在调用singletonFactory.getObject() 后实际的对象可能会需要代理的包装，才能成为我们实际程序使用的对象， 从而保存到二级缓存里去，这也是三级缓存和二级缓存的区别，二级缓存里保存的对象是经过了代理包装或替换的，三级缓存中的对象还存在不确定性。

### 6.**Spring无法解决的循环依赖场景**

Spring可以解正常解决通过属性进行依赖注入的循环依赖场景，但是无法解决通过构造方法进行注入的循环依赖场景，就像下面的代码一样，容器启动时Spring提示存在循环依赖然后终止程序。

```java
@Component
public class ObjectA {

    private  ObjectB b;

    @Autowired
    public ObjectA(ObjectB b) {
        this.b=b;
    }
    
}
@Component
public class ObjectA {

    private  ObjectB b;

    @Autowired
    public ObjectA(ObjectB b) {
        this.b = b;
    }
}

```

Spring运行结果，提示可能有循环依赖中断了程序

![img](/Users/mbpzy/images/v2-55554b155673c77c7ee15d7fa489a9d0_1440w.jpg)



为什么通过构造方法注入就无法解决呢，想其实我们了解JVM的对象创建过程就应该能理解，当JVM接收到一条new Object（）时候会执行下面的逻辑：

首先向内存中申请一块对象的内存区域，然后初始化对象成员变量信息并赋默认值（如 int类型为0，引用类型为nul），最后执行对象的构造方法。 那么从这里我们可以知道，当我们的构造方法执行完之前我们是无法获得一个对象的内存地址的。

当我们使用构造方法注入时，准备执行A对象的构造方法，但是构造方法属性依赖了B对象，必须先创建完B对象才能完成构造方法的执行，当创建B调用B对象的构造方法时，发现又依赖于A对象，所以B对象的构造方法也无法执行完毕，得先创建A，结果我们会发现对象A和对象B都无法完成构造方法的执行，那么此时两个对象都没法申请到一个内存地址，当对象内存都生成不了试想又如何为其依赖的属性赋值，显然不可能赋值为null。所以这种情况的循环依赖是没办法解决的，因为始终都没办法解决谁先创建的问题。