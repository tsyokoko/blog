## 一、依赖原则

假设，在 `JavaMavenService2` 模块中，`log4j` 的版本是 `1.2.7`，在 `JavaMavenService1` 模块中，它虽然继承于 `JavaMavenService2` 模块，但是它排除了在 `JavaMavenService2` 模块中继承 `1.2.7` 的版本，自己引入了`1.2.9` 的 `log4j`版本。

此时，相对于 `WebMavenDemo` 而言，`log4j.1.2.7.jar` 的依赖路径是 `JavaMavenService1 >> JavaMavenService2 >> log4j.1.2.7.jar`，长度是 3；而 `log4j.1.2.9.jar` 的依赖路径是 `JavaMavenService1 >> log4j.1.2.7.jar` 长度是 2。

所以 `WebMavenDemo` 继承的是 `JavaMavenService1` 模块中的 log 版本，而不是 `JavaMavenService2` 中的，这叫**路径优先原则(谁路径短用谁)**。

![依赖原则](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/1460000021610260.png)

此外，在路径相同的情况下，

![路径相同](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/1460000021610262.png)

这种场景依赖关系发生了变化，`WebMavenDemo` 项目依赖 `Sercive1` 和 `Service2`，它俩是同一个路径，那么谁在 `WebMavenDemo` 的 `pom.xml` 中先声明的依赖就用谁的版本。这叫**先定义先使用原则**。

比如：先声明 JavaMavenService1 所以 WebMavenDemo 继承它的 log4j.1.2.9.jar 依赖

```xml
<!--先声明 JavaMavenService1 所以 WebMavenDemo 继承它的 log4j.1.2.9.jar 依赖-->
<dependency>
    <groupId>com.nasus</groupId>
    <artifactId>JavaMavenService1</artifactId>
    <version>1.0.0</version>
</dependency>
<dependency>
    <groupId>com.nasus</groupId>
    <artifactId>JavaMavenService2</artifactId>
    <version>1.0.0</version>
</dependency>
```

- 参考：cnblogs.com/hzg110/p/6936101.html

## 二、依赖冲突的原因

项目的依赖 `service1` 和依赖 `service2` 同时引入了依赖 `log4j`。这时，如果依赖 `log4j` 在 `service1` 和 `service2` 中的版本不一致就**可能**导致依赖冲突。如下图：

![依赖冲突的原因](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/1460000021610263.png)

注意，上面我用的是**可能**，并不是说满足上面的条件就一定会发生依赖冲突。因为 maven 遵循上面提到的两个原则：

- **先定义先使用原则 (路径层级相同情况下)**
- **路径优先原则(谁路径短用谁)**

### 2.1 依赖冲突会报什么错？

依赖冲突通常两个错：`NoClassDefFoundError` 或 `NoSuchMethodError`，逐一讲解下导致这两种错误的原因：

- 以上图依赖关系为例，假设 `WebDemo` 通过排除 `service1` 中低版本的依赖，从而继承 `service2` 中的高版本的依赖。这时，如果 `WebDemo` 在执行过程中调用 `log4j(1.2.7)` 有，但是升级到 `log4j(1.2.9)`就缺失的类 `log`，就会导致运行期失败，出现很典型的依赖冲突时的 `NoClassDefFoundError` 错误。
- 还是以上图依赖关系为例，`WebDemo` 通过排除 `service1` 中低版本的依赖，从而继承 `service2` 中的高版本的依赖。`WebDemo` 调用了原来 `log4j(1.2.7)` 中有的方法 `log.info()`，但升级到 `log4j(1.2.7)` 后，`log.info()` 不存在了，就会抛出 `NoSuchMethodError` 错误.

所以说，当存在依赖冲突时，仅指望 maven 的两个原则来解决是不成熟的。不管是**路径优先原则**还是**先定义先使用原则**，都有可能造成以上的依赖冲突。那么如何解决它呢？

## 三、解决依赖冲突

通过上面的分析我们应该能理解到，解决依赖冲突的核心就是**使冲突的依赖版本统一，而且项目不报错**。

我们可以通过运行 maven 命令：`mvn dependency:tree` 查看项目的依赖树分析依赖，看那些以来有冲突，还是以上图举例：运行命令之后，查看依赖树的 log4j 依赖就会得到错误提示： `(1.2.7 omitted for conflict with 1.2.9)`

知道了如何查看冲突之后，就是解决冲突。

1、尝试升高 `service2` 的版本使他依赖的 `log` 版本与 `service1` 的 `log` 版本一致，但它可能会导致 `service2` 不能工作。

2、如果 `service2` 是个旧项目，找遍了也没找到与 `service1` 版本一致的 `log`，这时可以尝试拉低 `service1` 的版本使他依赖的 `log` 版本与 `service2` 的 `log` 版本一致，但可能会导致 `service1` 不能工作。

你可能说了，这又不行，那又不行，怎么办呢？别急，往下看，maven 解决依赖冲突主要用两种方法：

- **排除低版本，直接用高版本**

最理想的状况就是直接排除低版本，依赖高版本，一般情况下高版本会兼容低版本。如果 `service2` 并没有调用 `log4j.1.2.9` 升级所摒弃的方法或类时， 可以使用 `<exclusion>` 标签，排除掉 `service2` 中的 `log`。还是以上图举例：

```xml
<dependency>
    <groupId>com.nasus</groupId>
    <artifactId>service2</artifactId>
    <version>1.0.0</version>
    <!-- 排除低版本 log4j -->
    <exclusions>
        <exclusion>
            <groupId>log4j</groupId>
            <artifactId>log4j</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

看着到这里，你可能又说了。如果 `service2` 有用到 `log` 升级所摒弃的方法或类；而 `service1` 又必须用新版本的 `log`，怎么办？

第一，一般情况下，第三方依赖不会出现这种情况。如果出现了，那你就到 maven 中央仓库找下兼容两个版本的依赖。如果找不到，那只能换依赖。

第二，如果是自己公司的 jar 出现这种情况，那就是你们的 jar 管理非常混乱。建议重新开发，兼容旧版本。

## 四、使用 Maven Helper 插件解决依赖冲突

idea plugin 中搜索 `maven helper` 插件安装完之后，打开 pom 文件，发现左下角有个 `Dependency Analyzer` 选项，点击进入选 conflicts 选项，就可以看到当前有冲突的 jar 包，在右边 exclude 掉红色冲突的版本即可。

![解决冲突](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/1460000021610261.png)