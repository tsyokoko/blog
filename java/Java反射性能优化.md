# Java反射性能优化方案

调用Java的反射API是有较高的性能开销的

```java
Class class1 = Class.forName("com.xxx.TestReflect");

TestReflect tr = (TestReflect) class1.newInstance();

Method method = class1.getDeclaredMethod("mPrivate");

method.setAccessible(true);
```

通过反射访问、修改类的属性和方法时会远慢于直接操作，但性能问题的严重程度取决于在程序中是如何使用反射的。如果使用得很少，不是很频繁，性能将不会是什么问题；

##### 原因 

纠其原因，性能的开销主要在两方面： 

**1.产生了动态解析** 

无论是通过字符串获取Class、Method还是Field，都需要JVM的动态链接机制动态的进行解析和匹配，势必造成性能开销。 

**2.安全性验证** 
		每一次的反射调用都会造成Java安全机制进行额外的安全性验证，造成性能开销。 

**3.影响运行时优化** 

反射代码使得许多JVM的运行时优化无法进行。 

##### 处理方法 

**1.使用Cache **

 对通过反射调用获得的Class、Method、Field实例进行缓存，避免多次Dynamic Resolve。 

**2.使用MethodHandle类 **

Java 7开始提供了java.lang.invoke.MethodHandle类，MethodHandle类的安全性验证在获取实例时进行而不是每次调用时都要进行验证，减小开销。 

**3.使用Runtime创建的类 **

在编译时设计好一个接口，由该接口封装所有的反射调用。

在运行时动态生成一个类实现该接口，该动态生成的类一旦完成define就和普通类没有区别，不需要后续的Dynamic Resolve，没有额外的安全性验证，也不会影响JVM的运行时优化。

该方法不能覆盖反射API的所有Use case，例如某个反射调用需要修改某实例的private字段，是无法动态生成一个合法的类这样去做的。 